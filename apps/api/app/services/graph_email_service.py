"""Microsoft Graph email service — send emails via MS Graph REST API."""
from __future__ import annotations

import datetime
import logging
import uuid

import httpx
import msal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.graph_email_config import GraphEmailConfig
from app.utils.security import decrypt_field, encrypt_field

logger = logging.getLogger(__name__)


async def get_graph_config(db: AsyncSession) -> GraphEmailConfig | None:
    result = await db.execute(select(GraphEmailConfig).where(GraphEmailConfig.id == 1))
    return result.scalar_one_or_none()


async def upsert_graph_config(
    db: AsyncSession,
    *,
    updated_by: uuid.UUID,
    tenant_id: str | None = None,
    client_id: str | None = None,
    client_secret: str | None = None,
    from_email: str | None = None,
    is_active: bool | None = None,
) -> GraphEmailConfig:
    config = await get_graph_config(db)
    if config is None:
        config = GraphEmailConfig(id=1)
        db.add(config)

    if tenant_id is not None:
        config.tenant_id = tenant_id
    if client_id is not None:
        config.client_id = client_id
    if client_secret is not None:
        config.client_secret = encrypt_field(client_secret) if client_secret else client_secret
    if from_email is not None:
        config.from_email = from_email
    if is_active is not None:
        config.is_active = is_active

    config.updated_by = updated_by
    config.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.flush()
    return config


def _get_decrypted_secret(config: GraphEmailConfig) -> str | None:
    """Decrypt the client_secret stored in the config."""
    if not config.client_secret:
        return None
    return decrypt_field(config.client_secret)


async def _acquire_token(config: GraphEmailConfig) -> str:
    """Acquire an access token using MSAL client credentials flow."""
    secret = _get_decrypted_secret(config)
    if not secret:
        raise HTTPException(status_code=422, detail="Graph client secret is not set.")

    app = msal.ConfidentialClientApplication(
        client_id=config.client_id,
        client_credential=secret,
        authority=f"https://login.microsoftonline.com/{config.tenant_id}",
    )
    result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" not in result:
        error_desc = result.get("error_description", result.get("error", "Unknown error"))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to acquire Graph token: {error_desc}",
        )
    return result["access_token"]


async def check_graph_connection(config: GraphEmailConfig) -> tuple[bool, str]:
    """Test the Microsoft Graph configuration by acquiring a token."""
    try:
        token = await _acquire_token(config)
        return True, "Connected to Microsoft Graph successfully."
    except HTTPException as e:
        return False, e.detail
    except Exception as e:
        return False, str(e)


async def send_graph_email(
    config: GraphEmailConfig,
    *,
    to_email: str,
    subject: str,
    html_body: str,
) -> None:
    """Send an email via Microsoft Graph REST API."""
    token = await _acquire_token(config)

    url = f"https://graph.microsoft.com/v1.0/users/{config.from_email}/sendMail"
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": html_body,
            },
            "toRecipients": [
                {"emailAddress": {"address": to_email}}
            ],
        },
        "saveToSentItems": True,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code not in (200, 202):
        error_body = response.text[:500]
        logger.error("Graph email failed: %d %s", response.status_code, error_body)
        raise HTTPException(
            status_code=502,
            detail=f"Graph email failed ({response.status_code}): {error_body}",
        )

    logger.info("Graph email sent to %s | %s", to_email, subject)
