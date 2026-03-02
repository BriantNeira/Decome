"""Phase 4 — Email Alerts Engine tests (12 tests)."""
from __future__ import annotations

import datetime
import uuid as uuid_lib
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.email_alert_log import EmailAlertLog
from app.models.email_config import EmailConfig
from app.models.reminder import Reminder
from app.models.user import User
from app.services import alert_service


# ── Helpers ───────────────────────────────────────────────────────────────────

def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _make_account(db: AsyncSession) -> Account:
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10].upper()
    account = Account(name=f"AlertTest Account {uid}", code=uid)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def _make_reminder(
    db: AsyncSession,
    *,
    user_id,
    account_id,
    start_date: datetime.date,
    status: str = "open",
) -> Reminder:
    reminder = Reminder(
        user_id=user_id,
        account_id=account_id,
        title="Alert Engine Test Reminder",
        start_date=start_date,
        status=status,
        edit_count=0,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def _activate_config(db: AsyncSession, admin_id) -> EmailConfig:
    config = await alert_service.upsert_email_config(
        db,
        updated_by=admin_id,
        smtp_host="smtp.test.local",
        smtp_port=587,
        smtp_user="test@test.local",
        smtp_password="secret",
        from_email="noreply@test.local",
        from_name="Deminder Test",
        use_tls=True,
        is_active=True,
    )
    await db.commit()
    return config


async def _deactivate_config(db: AsyncSession, admin_id) -> None:
    await alert_service.upsert_email_config(db, updated_by=admin_id, is_active=False)
    await db.commit()


# ── Config endpoint tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_email_config_get_defaults(
    client: AsyncClient, admin_token: str
):
    """GET /api/email-config returns config (fields always present)."""
    res = await client.get("/api/email-config", headers=auth(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert "is_active" in data
    assert "use_tls" in data
    assert "smtp_password" not in data


@pytest.mark.asyncio
async def test_email_config_update(
    client: AsyncClient, admin_token: str
):
    """PATCH /api/email-config persists SMTP fields."""
    payload = {
        "smtp_host": "smtp.example.com",
        "smtp_port": 465,
        "smtp_user": "alerts@example.com",
        "from_email": "alerts@example.com",
        "from_name": "My Deminder",
        "use_tls": True,
    }
    res = await client.patch("/api/email-config", json=payload, headers=auth(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert data["smtp_host"] == "smtp.example.com"
    assert data["smtp_port"] == 465
    assert data["from_name"] == "My Deminder"
    assert "smtp_password" not in data


@pytest.mark.asyncio
async def test_email_config_toggle_active(
    client: AsyncClient, admin_token: str
):
    """PATCH /api/email-config can toggle is_active."""
    res = await client.patch("/api/email-config", json={"is_active": True}, headers=auth(admin_token))
    assert res.status_code == 200
    assert res.json()["is_active"] is True

    res = await client.patch("/api/email-config", json={"is_active": False}, headers=auth(admin_token))
    assert res.status_code == 200
    assert res.json()["is_active"] is False


# ── Alert engine tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_alert_skipped_when_inactive(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """run_alert_checks returns skipped reason when config is disabled."""
    await _deactivate_config(db, admin_user.id)
    result = await alert_service.run_alert_checks(db)
    assert result["sent"] == 0
    assert result["skipped"] is not None


@pytest.mark.asyncio
async def test_alert_7day_sent(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """7-day alert fires for a reminder due in exactly 7 days."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    target_date = datetime.date.today() + datetime.timedelta(days=7)
    await _make_reminder(db, user_id=bdm_user.id, account_id=account.id, start_date=target_date)

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert result["sent"] >= 1
    assert mock_send.called


@pytest.mark.asyncio
async def test_alert_1day_sent(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """1-day alert fires for a reminder due tomorrow."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    await _make_reminder(db, user_id=bdm_user.id, account_id=account.id, start_date=tomorrow)

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert result["sent"] >= 1
    assert mock_send.called


@pytest.mark.asyncio
async def test_alert_overdue_sent(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """Overdue alert fires for past-due open reminder."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    past_date = datetime.date.today() - datetime.timedelta(days=3)
    await _make_reminder(db, user_id=bdm_user.id, account_id=account.id, start_date=past_date)

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert result["sent"] >= 1
    assert mock_send.called


@pytest.mark.asyncio
async def test_alert_no_duplicate(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """Second run does not send duplicate alerts for the same reminder."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    target_date = datetime.date.today() + datetime.timedelta(days=7)
    await _make_reminder(db, user_id=bdm_user.id, account_id=account.id, start_date=target_date)

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock):
        first = await alert_service.run_alert_checks(db)
        await db.commit()
        second = await alert_service.run_alert_checks(db)
        await db.commit()

    assert first["sent"] >= 1
    assert second["sent"] == 0, "No duplicate emails on second run"


@pytest.mark.asyncio
async def test_alert_skip_completed(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """Completed reminders are NOT alerted."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    target_date = datetime.date.today() + datetime.timedelta(days=7)
    await _make_reminder(
        db, user_id=bdm_user.id, account_id=account.id,
        start_date=target_date, status="completed",
    )

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert not mock_send.called


@pytest.mark.asyncio
async def test_alert_skip_cancelled(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """Cancelled reminders are NOT alerted."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    target_date = datetime.date.today() + datetime.timedelta(days=1)
    await _make_reminder(
        db, user_id=bdm_user.id, account_id=account.id,
        start_date=target_date, status="cancelled",
    )

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert not mock_send.called


@pytest.mark.asyncio
async def test_alert_log_recorded_on_failure(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """SMTP failure creates a 'failed' log entry."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    target_date = datetime.date.today() + datetime.timedelta(days=7)
    reminder = await _make_reminder(
        db, user_id=bdm_user.id, account_id=account.id, start_date=target_date,
    )

    with patch(
        "app.services.email_service.send_alert_email",
        new_callable=AsyncMock,
        side_effect=Exception("SMTP connection refused"),
    ):
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert result["failed"] >= 1
    assert result["sent"] == 0

    logs = (
        await db.execute(
            select(EmailAlertLog).where(
                EmailAlertLog.reminder_id == reminder.id,
                EmailAlertLog.status == "failed",
            )
        )
    ).scalars().all()
    assert len(logs) >= 1
    assert "SMTP" in logs[0].error_message


@pytest.mark.asyncio
async def test_alert_logs_list_endpoint(
    client: AsyncClient, admin_token: str
):
    """GET /api/email-config/logs returns paginated list."""
    res = await client.get("/api/email-config/logs?limit=50", headers=auth(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_run_manual_endpoint(
    client: AsyncClient, admin_token: str
):
    """POST /api/email-config/run returns sent/failed/skipped keys."""
    res = await client.post("/api/email-config/run", headers=auth(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert "sent" in data
    assert "failed" in data


@pytest.mark.asyncio
async def test_alert_overdue_due_today(
    db: AsyncSession, admin_user: User, bdm_user: User
):
    """Overdue alert fires for a reminder due exactly TODAY (start_date == today)."""
    await _activate_config(db, admin_user.id)
    account = await _make_account(db)
    today = datetime.date.today()
    await _make_reminder(db, user_id=bdm_user.id, account_id=account.id, start_date=today)

    with patch("app.services.email_service.send_alert_email", new_callable=AsyncMock) as mock_send:
        result = await alert_service.run_alert_checks(db)
        await db.commit()

    assert result["sent"] >= 1, "A reminder due today must trigger an overdue alert"
    assert mock_send.called
