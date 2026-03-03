import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.email_alert import (
    AlertRunResult,
    EmailAlertLogListResponse,
    EmailAlertLogRead,
    EmailConfigRead,
    EmailConfigUpdate,
    TestEmailRequest,
)
from app.services import alert_service, email_service

router = APIRouter(prefix="/api/email-config", tags=["email-alerts"])


@router.get("", response_model=EmailConfigRead)
async def get_email_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await alert_service.get_email_config(db)
    if config is None:
        # Return safe defaults when never configured
        from app.models.email_config import EmailConfig
        return EmailConfig(
            id=1, smtp_host=None, smtp_port=587, smtp_user=None, smtp_password=None,
            from_email=None, from_name="Deminder", use_tls=True, is_active=False,
        )
    return config


@router.patch("", response_model=EmailConfigRead)
async def update_email_config(
    data: EmailConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await alert_service.upsert_email_config(
        db,
        updated_by=current_user.id,
        **data.model_dump(exclude_unset=True),
    )
    await db.commit()
    await db.refresh(config)
    return config


@router.post("/test", status_code=status.HTTP_200_OK)
async def send_test_email(
    body: TestEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await alert_service.get_email_config(db)
    if not config or not config.smtp_host:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="SMTP is not configured yet.")

    subject = "Deminder — Test Email"
    html_body = """
    <html><body style="font-family:Inter,Arial,sans-serif;padding:32px">
      <h2 style="color:#9AAE2F">Test Email</h2>
      <p>If you received this message, your SMTP configuration is working correctly.</p>
      <p style="color:#5E6060;font-size:13px">Sent from Deminder Email Alerts Engine</p>
    </body></html>
    """
    await email_service.send_alert_email(
        config, to_email=str(body.to_email), subject=subject, html_body=html_body
    )
    return {"detail": f"Test email sent to {body.to_email}"}


@router.post("/run", response_model=AlertRunResult)
async def run_alerts_now(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Manually trigger the alert check (useful for testing / admin override)."""
    result = await alert_service.run_alert_checks(db)
    await db.commit()
    return result


@router.get("/logs", response_model=EmailAlertLogListResponse)
async def list_alert_logs(
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    logs, total = await alert_service.list_alert_logs(db, skip=skip, limit=limit, status=status)
    return EmailAlertLogListResponse(
        items=[EmailAlertLogRead.from_orm_with_title(log) for log in logs],
        total=total,
    )


@router.post("/logs/{log_id}/retry", response_model=EmailAlertLogRead)
async def retry_alert_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Retry a specific failed alert log — bypasses the 'already sent' deduplication."""
    new_log = await alert_service.retry_alert_log(db, log_id)
    await db.commit()
    await db.refresh(new_log)
    return EmailAlertLogRead.from_orm_with_title(new_log)
