"""Tests for AI email generation with mocked LLM."""
import sys
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.utils.security import encrypt_field


def make_mock_config():
    config = MagicMock()
    config.provider = "openai"
    config.model = "gpt-4o-mini"
    config.api_key = encrypt_field("sk-test")
    config.max_tokens_per_request = 1500
    config.is_active = True
    return config


@pytest.mark.asyncio
async def test_generate_email_openai_mock():
    """Test that generate_email parses JSON response correctly."""
    from app.services.llm_service import generate_email

    config = make_mock_config()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"subject": "Test Subject", "body": "Test Body"}'
    mock_response.usage.total_tokens = 100

    mock_openai_module = MagicMock()
    mock_client = AsyncMock()
    mock_openai_module.AsyncOpenAI.return_value = mock_client
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch.dict(sys.modules, {"openai": mock_openai_module}):
        subject, body, tokens = await generate_email(
            config,
            rendered_subject="Hello {{account_name}}",
            rendered_body="Dear customer",
            tone="formal",
            profile_text=None,
            reminder_title="Test Reminder",
            due_date="2026-03-15",
        )
        assert subject == "Test Subject"
        assert body == "Test Body"
        assert tokens == 100


@pytest.mark.asyncio
async def test_generate_email_strips_markdown_fence():
    """LLM sometimes wraps JSON in ```json ... ``` — should be stripped before parsing."""
    from app.services.llm_service import generate_email

    config = make_mock_config()
    # Simulate LLM wrapping the JSON in a markdown code block
    raw = '```json\n{"subject": "Fenced Subject", "body": "Fenced Body"}\n```'
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = raw
    mock_response.usage.total_tokens = 50

    mock_openai_module = MagicMock()
    mock_client = AsyncMock()
    mock_openai_module.AsyncOpenAI.return_value = mock_client
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch.dict(sys.modules, {"openai": mock_openai_module}):
        subject, body, tokens = await generate_email(
            config,
            rendered_subject="Hello",
            rendered_body="Body",
            tone="formal",
            profile_text=None,
            reminder_title="Test",
            due_date="2026-03-15",
        )
        assert subject == "Fenced Subject"
        assert body == "Fenced Body"
        assert tokens == 50


@pytest.mark.asyncio
async def test_generate_email_strips_plain_fence():
    """Also handles plain ``` (no language specifier) wrapping."""
    from app.services.llm_service import generate_email

    config = make_mock_config()
    raw = '```\n{"subject": "Plain Fenced", "body": "Plain Body"}\n```'
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = raw
    mock_response.usage.total_tokens = 30

    mock_openai_module = MagicMock()
    mock_client = AsyncMock()
    mock_openai_module.AsyncOpenAI.return_value = mock_client
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch.dict(sys.modules, {"openai": mock_openai_module}):
        subject, body, tokens = await generate_email(
            config,
            rendered_subject="Hello",
            rendered_body="Body",
            tone="direct",
            profile_text=None,
            reminder_title="Test",
            due_date="2026-03-15",
        )
        assert subject == "Plain Fenced"
        assert body == "Plain Body"


@pytest.mark.asyncio
async def test_budget_check_exceeded():
    """Test that check_budget raises 422 when budget exceeded."""
    from app.services.budget_service import check_budget
    from fastapi import HTTPException
    from unittest.mock import AsyncMock, patch

    user_id = uuid.uuid4()

    mock_budget = MagicMock()
    mock_budget.monthly_limit = 100

    with patch("app.services.budget_service.get_budget", return_value=mock_budget), \
         patch("app.services.budget_service.get_monthly_usage", return_value=100):
        db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await check_budget(db, user_id)
        assert exc_info.value.status_code == 422
        assert "exceeded" in exc_info.value.detail


@pytest.mark.asyncio
async def test_budget_check_unlimited():
    """Test that check_budget passes when monthly_limit=0 (unlimited)."""
    from app.services.budget_service import check_budget
    from unittest.mock import AsyncMock, patch

    user_id = uuid.uuid4()

    mock_budget = MagicMock()
    mock_budget.monthly_limit = 0  # unlimited

    with patch("app.services.budget_service.get_budget", return_value=mock_budget):
        db = AsyncMock()
        # Should not raise
        await check_budget(db, user_id)


@pytest.mark.asyncio
async def test_budget_check_no_budget():
    """Test that check_budget passes when no budget row exists."""
    from app.services.budget_service import check_budget
    from unittest.mock import AsyncMock, patch

    user_id = uuid.uuid4()

    with patch("app.services.budget_service.get_budget", return_value=None):
        db = AsyncMock()
        # Should not raise
        await check_budget(db, user_id)


@pytest.mark.asyncio
async def test_generate_auto_selects_template_by_type():
    """
    When template_id=None and reminder has a type_id, generate_for_reminder
    should auto-select the template associated with that type.
    """
    import sys
    from unittest.mock import patch, AsyncMock, MagicMock

    reminder_id = uuid.uuid4()
    user_id = uuid.uuid4()
    account_id = uuid.uuid4()
    template_id = uuid.uuid4()
    type_id = 3

    # Build minimal mock reminder
    mock_reminder = MagicMock()
    mock_reminder.id = reminder_id
    mock_reminder.account_id = account_id
    mock_reminder.type_id = type_id
    mock_reminder.title = "Seasonal Order"
    mock_reminder.start_date = "2026-06-01"
    mock_reminder.notes = None
    mock_account = MagicMock(); mock_account.name = "Acme"
    mock_program = MagicMock(); mock_program.name = "LATAM"
    mock_user = MagicMock(); mock_user.full_name = "Jane"
    mock_reminder.account = mock_account
    mock_reminder.program = mock_program
    mock_reminder.user = mock_user

    # Template that matches type_id=3
    mock_template = MagicMock()
    mock_template.id = template_id
    mock_template.subject_template = "Order {{account_name}}"
    mock_template.body_template = "Dear {{contact_name}}, please order."

    # Mocked DB execute results
    mock_db = AsyncMock()
    execute_results = []

    # 1st execute: select Reminder
    r1 = MagicMock(); r1.scalar_one_or_none.return_value = mock_reminder
    # 2nd execute: auto-select EmailTemplate by type_id
    r2 = MagicMock(); r2.scalar_one_or_none.return_value = mock_template
    # 3rd execute: template_service.get_template (called with resolved_template_id)
    r3 = MagicMock(); r3.scalar_one_or_none.return_value = mock_template
    # 4th execute: CustomerProfile (returns None)
    r4 = MagicMock(); r4.scalar_one_or_none.return_value = None
    execute_results = iter([r1, r2, r3, r4])
    mock_db.execute = AsyncMock(side_effect=lambda *a, **kw: next(execute_results))

    # Mock LLM config
    mock_config = make_mock_config()

    # Mock openai module for LLM call
    mock_openai_module = MagicMock()
    mock_client = AsyncMock()
    mock_openai_module.AsyncOpenAI.return_value = mock_client
    mock_llm_response = MagicMock()
    mock_llm_response.choices = [MagicMock()]
    mock_llm_response.choices[0].message.content = '{"subject": "Order Acme", "body": "Dear customer, place your order."}'
    mock_llm_response.usage.total_tokens = 50
    mock_client.chat.completions.create = AsyncMock(return_value=mock_llm_response)

    with patch("app.services.generate_service.budget_service.check_budget", new=AsyncMock()), \
         patch("app.services.generate_service.llm_service.get_llm_config", new=AsyncMock(return_value=mock_config)), \
         patch("app.services.generate_service.budget_service.log_usage", new=AsyncMock()), \
         patch.dict(sys.modules, {"openai": mock_openai_module}):
        from app.services.generate_service import generate_for_reminder

        # Mock db.add + commit + refresh
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        saved_msg = MagicMock()
        saved_msg.id = uuid.uuid4()
        saved_msg.template_id = template_id  # should be auto-selected template
        mock_db.refresh = AsyncMock()

        # Patch the GeneratedMessage constructor
        with patch("app.services.generate_service.GeneratedMessage") as MockMsg:
            mock_instance = MagicMock()
            mock_instance.id = uuid.uuid4()
            mock_instance.template_id = template_id
            MockMsg.return_value = mock_instance

            result = await generate_for_reminder(
                mock_db,
                reminder_id=reminder_id,
                template_id=None,  # no explicit template
                contact_id=None,
                tone="formal",
                user_id=user_id,
            )
            # Verify auto-selected template_id was used in GeneratedMessage
            call_kwargs = MockMsg.call_args[1]
            assert call_kwargs["template_id"] == template_id, \
                f"Expected template_id={template_id}, got {call_kwargs['template_id']}"
