"""Microsoft Graph email configuration endpoints (admin only)."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import require_roles
from app.models.user import User
from app.services import graph_email_service

router = APIRouter(prefix="/api/graph-email-config", tags=["graph-email"])


class GraphEmailConfigRead(BaseModel):
    tenant_id: str | None = None
    client_id: str | None = None
    client_secret_set: bool = False
    from_email: str | None = None
    is_active: bool = False
    updated_at: str | None = None


class GraphEmailConfigUpdate(BaseModel):
    tenant_id: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    from_email: str | None = None
    is_active: bool | None = None


def _to_read(config) -> dict:
    return {
        "tenant_id": config.tenant_id,
        "client_id": config.client_id,
        "client_secret_set": bool(config.client_secret),
        "from_email": config.from_email,
        "is_active": config.is_active,
        "updated_at": str(config.updated_at) if config.updated_at else None,
    }


@router.get("", response_model=GraphEmailConfigRead)
async def get_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await graph_email_service.get_graph_config(db)
    if config is None:
        return GraphEmailConfigRead()
    return GraphEmailConfigRead(**_to_read(config))


@router.patch("", response_model=GraphEmailConfigRead)
async def update_config(
    body: GraphEmailConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    fields = body.model_dump(exclude_none=True)
    config = await graph_email_service.upsert_graph_config(
        db,
        updated_by=current_user.id,
        **fields,
    )
    await db.commit()
    await db.refresh(config)
    return GraphEmailConfigRead(**_to_read(config))


class TestEmailRequest(BaseModel):
    to_email: str | None = None


@router.post("/test")
async def test_connection(
    body: TestEmailRequest | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await graph_email_service.get_graph_config(db)
    if not config or not config.tenant_id or not config.client_id:
        return {"ok": False, "message": "Microsoft Graph is not configured. Set Tenant ID, Client ID, and Client Secret first."}

    ok, message = await graph_email_service.check_graph_connection(config)

    # If test passes and a recipient is provided, send a test email
    if ok and body and body.to_email:
        try:
            await graph_email_service.send_graph_email(
                config,
                to_email=body.to_email,
                subject="Deminder — Test Email (Microsoft Graph)",
                html_body="""
                <html><body style="font-family:Inter,Arial,sans-serif;padding:32px">
                  <h2 style="color:#9AAE2F">Test Email</h2>
                  <p>If you received this message, your Microsoft Graph email configuration is working correctly.</p>
                  <p style="color:#5E6060;font-size:13px">Sent from Deminder via Microsoft Graph</p>
                </body></html>
                """,
            )
            message += f" Test email sent to {body.to_email}."
        except Exception as exc:
            message += f" But test email failed: {exc}"

    return {"ok": ok, "message": message}
