"""LLM orchestration service — supports OpenAI and Anthropic."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_config import LLMConfig
from app.utils.security import decrypt_field, encrypt_field

logger = logging.getLogger(__name__)


def _clean_llm_error(err_str: str) -> str:
    """Extract a human-readable message from Anthropic / OpenAI SDK errors.

    Both SDKs raise exceptions whose str() looks like:
      "Error code: 401 - {'type': 'error', 'error': {'type': '...', 'message': '...'}}"
    The embedded dict uses Python single-quote syntax, so we use ast.literal_eval.
    """
    import ast, re
    try:
        # Locate the first { ... } block in the error string
        match = re.search(r"\{.*\}", err_str, re.DOTALL)
        if match:
            data = ast.literal_eval(match.group())
            if isinstance(data, dict):
                # Anthropic: {"type":"error","error":{"type":"...","message":"..."}}
                inner = data.get("error")
                if isinstance(inner, dict):
                    msg = inner.get("message", "")
                    if msg:
                        return str(msg)
                # Flat message key (some OpenAI errors)
                if "message" in data:
                    return str(data["message"])
    except Exception:
        pass
    # Fallback: strip the leading "Error code: 4xx - " prefix if present
    cleaned = re.sub(r"^Error code:\s*\d+\s*-\s*", "", err_str)
    return cleaned.strip()


async def get_llm_config(db: AsyncSession) -> LLMConfig | None:
    result = await db.execute(select(LLMConfig).where(LLMConfig.id == 1))
    return result.scalar_one_or_none()


async def upsert_llm_config(db: AsyncSession, **fields) -> LLMConfig:
    # Encrypt the API key before storing
    if "api_key" in fields and fields["api_key"]:
        fields["api_key"] = encrypt_field(fields["api_key"])

    config = await get_llm_config(db)
    if config is None:
        config = LLMConfig(id=1, **fields)
        db.add(config)
    else:
        for k, v in fields.items():
            setattr(config, k, v)
    await db.commit()
    await db.refresh(config)
    return config


def _get_decrypted_api_key(config: LLMConfig) -> str | None:
    """Decrypt the API key stored in the config."""
    if not config.api_key:
        return None
    return decrypt_field(config.api_key)


async def list_models(config: LLMConfig) -> list[str]:
    """Fetch available model IDs from the configured provider using the stored API key."""
    api_key = _get_decrypted_api_key(config)
    if not api_key:
        return []
    try:
        if config.provider == "openai":
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            page = await client.models.list()
            # Keep only chat-capable model families
            ids = [
                m.id for m in page.data
                if m.id.startswith(("gpt-", "o1-", "o3-", "o4-"))
            ]
            return sorted(ids, reverse=True)  # newest first

        elif config.provider == "anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=api_key)
            page = await client.models.list()
            ids = [m.id for m in page.data]
            return sorted(ids, reverse=True)  # newest first

        return []
    except Exception as exc:
        logger.warning("list_models failed for %s: %s", config.provider, exc)
        return []


async def test_connection(config: LLMConfig) -> tuple[bool, str]:
    """Send a minimal test request to verify credentials. Returns (ok, message)."""
    api_key = _get_decrypted_api_key(config)
    if not api_key:
        return False, "API key is not set."
    try:
        if config.provider == "openai":
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True, f"Connected: {config.model} | 1 token used"
        elif config.provider == "anthropic":
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=api_key)
            response = await client.messages.create(
                model=config.model,
                max_tokens=1,
                messages=[{"role": "user", "content": "ping"}],
            )
            return True, f"Connected: {config.model} | 1 token used"
        else:
            return False, f"Unknown provider: {config.provider}"
    except Exception as e:
        return False, _clean_llm_error(str(e))


async def generate_email(
    config: LLMConfig,
    *,
    rendered_subject: str,
    rendered_body: str,
    tone: str,
    profile_text: str | None,
    reminder_title: str,
    due_date: str,
) -> tuple[str, str, int]:
    """Call LLM to generate a professional email. Returns (subject, body, tokens_used)."""
    system_prompt = (
        "You are a professional email writer for a B2B sales team. "
        'Respond ONLY with valid JSON in the format: {"subject": "...", "body": "..."}. '
        "IMPORTANT: If any information is missing or unknown, write exactly "
        '"PLEASE DEFINE IT [field_name]" in that position. Never invent or hallucinate. '
        f"Write in English only. Tone: {tone}."
    )

    profile_section = profile_text or "No customer profile available."
    user_prompt = (
        f"Write a business email using this template:\n"
        f"SUBJECT: {rendered_subject}\n"
        f"BODY: {rendered_body}\n\n"
        f"Customer context:\n{profile_section}\n\n"
        f'Additional context: Reminder "{reminder_title}" due on {due_date}.'
    )

    subject, body, tokens = await _call_llm(config, system_prompt, user_prompt, is_json=True)
    return subject, body, tokens


async def generate_profile(
    config: LLMConfig,
    *,
    account_name: str,
    knowledge: dict,
    docs_text: str,
    notes_text: str,
) -> tuple[str, int]:
    """Generate a customer profile text. Returns (profile_text, tokens_used)."""
    system_prompt = (
        "Create a concise customer profile (150-250 words) in professional English. "
        "Write only factual information. Do not speculate or invent."
    )
    user_prompt = (
        f"Company: {account_name}\n"
        f"Website: {knowledge.get('website', 'N/A')} | "
        f"Industry: {knowledge.get('industry', 'N/A')} | "
        f"Type: {knowledge.get('account_type', 'N/A')}\n"
        f"Additional observations: {knowledge.get('observations', 'N/A')}\n"
        f"Document content: {docs_text[:3000] if docs_text else 'None'}\n"
        f"Recent notes: {notes_text or 'None'}\n"
        "Generate the customer profile now:"
    )

    _, profile_text, tokens = await _call_llm(config, system_prompt, user_prompt, is_json=False)
    return profile_text, tokens


async def generate_diagnosis(config: LLMConfig, kpi_data: str) -> tuple[str, int]:
    """Generate AI diagnosis from KPI data. Returns (text, tokens_used)."""
    system_prompt = (
        "You are a business intelligence analyst for a B2B sales operations team. "
        "Analyze the KPI data provided and give actionable insights. "
        "Focus on: completion rates, overdue trends, BDM performance, and recommendations. "
        "Write in professional English, 200-400 words."
    )
    _, text, tokens = await _call_llm(config, system_prompt, kpi_data, is_json=False)
    return text, tokens


async def _call_llm(
    config: LLMConfig,
    system_prompt: str,
    user_prompt: str,
    *,
    is_json: bool,
) -> tuple[str, str, int]:
    """Internal: call the configured provider. Returns (subject_or_empty, body_or_text, tokens)."""
    max_tokens = config.max_tokens_per_request or 1500
    api_key = _get_decrypted_api_key(config)
    if not api_key:
        raise ValueError("LLM API key is not set.")

    if config.provider == "openai":
        import openai
        client = openai.AsyncOpenAI(api_key=api_key)
        kwargs: dict[str, Any] = dict(
            model=config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
        )
        if is_json:
            kwargs["response_format"] = {"type": "json_object"}
        response = await client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content or ""
        tokens = response.usage.total_tokens if response.usage else 0

    elif config.provider == "anthropic":
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        response = await client.messages.create(
            model=config.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        content = response.content[0].text if response.content else ""
        tokens = (response.usage.input_tokens + response.usage.output_tokens) if response.usage else 0

    else:
        raise ValueError(f"Unknown LLM provider: {config.provider}")

    if is_json:
        try:
            # Some models wrap JSON in markdown code fences (```json ... ```)
            stripped = content.strip()
            if stripped.startswith("```"):
                stripped = re.sub(r"^```(?:json)?\s*\n?", "", stripped)
                stripped = re.sub(r"\n?```\s*$", "", stripped).strip()
            data = json.loads(stripped)
            return data.get("subject", ""), data.get("body", ""), tokens
        except Exception:
            logger.error("LLM returned non-JSON for email: %s", content[:200])
            return "", content, tokens
    else:
        return "", content, tokens
