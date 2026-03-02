import uuid
import datetime
from pydantic import BaseModel, EmailStr


# ── Email Config ──────────────────────────────────────────────────────────────

class EmailConfigUpdate(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None   # write-only; never returned in GET
    from_email: str | None = None
    from_name: str | None = None
    use_tls: bool | None = None
    is_active: bool | None = None


class EmailConfigRead(BaseModel):
    smtp_host: str | None
    smtp_port: int | None
    smtp_user: str | None
    from_email: str | None
    from_name: str | None
    use_tls: bool
    is_active: bool
    updated_at: datetime.datetime | None

    model_config = {"from_attributes": True}


class TestEmailRequest(BaseModel):
    to_email: EmailStr


# ── Alert Logs ────────────────────────────────────────────────────────────────

class EmailAlertLogRead(BaseModel):
    id: int
    reminder_id: uuid.UUID
    reminder_title: str | None = None
    alert_type: str
    sent_to: str
    status: str
    error_message: str | None
    sent_at: datetime.datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_title(cls, log) -> "EmailAlertLogRead":
        title = log.reminder.title if log.reminder else None
        return cls(
            id=log.id,
            reminder_id=log.reminder_id,
            reminder_title=title,
            alert_type=log.alert_type,
            sent_to=log.sent_to,
            status=log.status,
            error_message=log.error_message,
            sent_at=log.sent_at,
        )


class EmailAlertLogListResponse(BaseModel):
    items: list[EmailAlertLogRead]
    total: int


class AlertRunResult(BaseModel):
    sent: int
    failed: int
    skipped: str | None = None
