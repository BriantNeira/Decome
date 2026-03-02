"""Email alert business logic: check due reminders and dispatch notifications."""
from __future__ import annotations

import datetime
import logging
import uuid

from sqlalchemy import func, select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_alert_log import EmailAlertLog
from app.models.email_config import EmailConfig
from app.models.reminder import Reminder
from app.services import email_service

logger = logging.getLogger(__name__)


# ── Config helpers ────────────────────────────────────────────────────────────

async def get_email_config(db: AsyncSession) -> EmailConfig | None:
    result = await db.execute(select(EmailConfig).where(EmailConfig.id == 1))
    return result.scalar_one_or_none()


async def upsert_email_config(
    db: AsyncSession,
    *,
    updated_by: uuid.UUID,
    smtp_host: str | None = None,
    smtp_port: int | None = None,
    smtp_user: str | None = None,
    smtp_password: str | None = None,
    from_email: str | None = None,
    from_name: str | None = None,
    use_tls: bool | None = None,
    is_active: bool | None = None,
) -> EmailConfig:
    config = await get_email_config(db)
    if config is None:
        config = EmailConfig(id=1)
        db.add(config)

    if smtp_host is not None:
        config.smtp_host = smtp_host
    if smtp_port is not None:
        config.smtp_port = smtp_port
    if smtp_user is not None:
        config.smtp_user = smtp_user
    if smtp_password is not None:
        config.smtp_password = smtp_password
    if from_email is not None:
        config.from_email = from_email
    if from_name is not None:
        config.from_name = from_name
    if use_tls is not None:
        config.use_tls = use_tls
    if is_active is not None:
        config.is_active = is_active

    config.updated_by = updated_by
    config.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.flush()
    return config


# ── Alert log helpers ─────────────────────────────────────────────────────────

async def list_alert_logs(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
) -> tuple[list[EmailAlertLog], int]:
    q = select(EmailAlertLog)
    count_q = select(func.count()).select_from(EmailAlertLog)
    if status:
        q = q.where(EmailAlertLog.status == status)
        count_q = count_q.where(EmailAlertLog.status == status)

    q = q.order_by(EmailAlertLog.sent_at.desc()).offset(skip).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    total = (await db.execute(count_q)).scalar_one()
    return list(rows), total


# ── Core alert engine ─────────────────────────────────────────────────────────

async def run_alert_checks(db: AsyncSession) -> dict:
    """
    Run all three alert types:
      - 7-day: start_date = today+7, status open/in_progress, no prior 7_day log
      - 1-day: start_date = tomorrow, status open/in_progress, no prior 1_day log
      - overdue: start_date <= today, status open/in_progress, no overdue log TODAY

    Returns counts: {"sent": N, "failed": N, "skipped": reason|None}
    """
    config = await get_email_config(db)
    if not config or not config.is_active:
        reason = "email_disabled" if config and not config.is_active else "no_config"
        logger.info("[AlertEngine] Skipped — %s", reason)
        return {"sent": 0, "failed": 0, "skipped": reason}

    today = datetime.date.today()
    sent = 0
    failed = 0

    # ── 7-day ────────────────────────────────────────────────────────────
    for r in await _get_eligible(db, today + datetime.timedelta(days=7), "7_day"):
        ok = await _send_and_log(db, r, "7_day", config)
        if ok:
            sent += 1
        else:
            failed += 1

    # ── 1-day ────────────────────────────────────────────────────────────
    for r in await _get_eligible(db, today + datetime.timedelta(days=1), "1_day"):
        ok = await _send_and_log(db, r, "1_day", config)
        if ok:
            sent += 1
        else:
            failed += 1

    # ── Overdue ──────────────────────────────────────────────────────────
    for r in await _get_overdue_not_sent_today(db, today):
        ok = await _send_and_log(db, r, "overdue", config)
        if ok:
            sent += 1
        else:
            failed += 1

    logger.info("[AlertEngine] Done — sent=%d  failed=%d", sent, failed)
    return {"sent": sent, "failed": failed, "skipped": None}


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_eligible(
    db: AsyncSession, target_date: datetime.date, alert_type: str
) -> list[Reminder]:
    """Reminders due on target_date with no prior log for alert_type."""
    already_sent = (
        select(EmailAlertLog.id).where(
            EmailAlertLog.reminder_id == Reminder.id,
            EmailAlertLog.alert_type == alert_type,
        )
    )
    stmt = (
        select(Reminder)
        .where(
            Reminder.start_date == target_date,
            Reminder.status.in_(["open", "in_progress"]),
            ~exists(already_sent),
        )
    )
    return list((await db.execute(stmt)).scalars().all())


async def _get_overdue_not_sent_today(
    db: AsyncSession, today: datetime.date
) -> list[Reminder]:
    """Overdue reminders (due today or earlier) that haven't received an 'overdue' alert today."""
    already_sent_today = (
        select(EmailAlertLog.id).where(
            EmailAlertLog.reminder_id == Reminder.id,
            EmailAlertLog.alert_type == "overdue",
            func.date(EmailAlertLog.sent_at) == today,
        )
    )
    stmt = (
        select(Reminder)
        .where(
            Reminder.start_date <= today,  # include today (due today = needs alert)
            Reminder.status.in_(["open", "in_progress"]),
            ~exists(already_sent_today),
        )
    )
    return list((await db.execute(stmt)).scalars().all())


async def retry_alert_log(db: AsyncSession, log_id: int) -> EmailAlertLog:
    """
    Retry a previously failed alert log entry.
    Bypasses the 'already sent' check and sends directly to the reminder's BDM.
    Creates a new EmailAlertLog entry for the retry attempt.
    Raises HTTPException if log not found, not failed, or config not available.
    """
    from fastapi import HTTPException, status as http_status
    from sqlalchemy.orm import selectinload

    # Load the failed log with reminder relationship
    log_result = await db.execute(
        select(EmailAlertLog)
        .options(selectinload(EmailAlertLog.reminder))
        .where(EmailAlertLog.id == log_id)
    )
    log = log_result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Alert log not found")
    if log.status != "failed":
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail="Only failed alerts can be retried")

    config = await get_email_config(db)
    if not config or not config.smtp_host:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SMTP is not configured")

    reminder = log.reminder
    if not reminder:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Reminder no longer exists")

    # Load user for reminder to get email
    user_result = await db.execute(
        select(Reminder)
        .options(
            selectinload(Reminder.user),
            selectinload(Reminder.account),
            selectinload(Reminder.reminder_type),
        )
        .where(Reminder.id == reminder.id)
    )
    reminder_full = user_result.scalar_one_or_none()
    if not reminder_full:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Reminder not found")

    user_email = reminder_full.user.email if reminder_full.user else None
    if not user_email:
        raise HTTPException(status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Reminder has no associated user email")

    subject, html_body = email_service.build_alert_email(reminder_full, log.alert_type)
    new_log = EmailAlertLog(
        reminder_id=reminder.id,
        alert_type=log.alert_type,
        sent_to=user_email,
        status="sent",
    )
    try:
        await email_service.send_alert_email(config, to_email=user_email, subject=subject, html_body=html_body)
        new_log.status = "sent"
    except Exception as exc:
        new_log.status = "failed"
        new_log.error_message = str(exc)[:500]

    db.add(new_log)
    await db.flush()
    return new_log


async def _send_and_log(
    db: AsyncSession,
    reminder: Reminder,
    alert_type: str,
    config: EmailConfig,
) -> bool:
    """Attempt to send the email and persist a log entry. Returns True on success."""
    user_email = reminder.user.email if reminder.user else None
    if not user_email:
        logger.warning("[AlertEngine] Reminder %s has no user email — skipped", reminder.id)
        return False

    subject, html_body = email_service.build_alert_email(reminder, alert_type)
    log = EmailAlertLog(
        reminder_id=reminder.id,
        alert_type=alert_type,
        sent_to=user_email,
        status="sent",
    )
    try:
        await email_service.send_alert_email(config, to_email=user_email, subject=subject, html_body=html_body)
        log.status = "sent"
        db.add(log)
        await db.flush()
        return True
    except Exception as exc:
        log.status = "failed"
        log.error_message = str(exc)[:500]
        db.add(log)
        await db.flush()
        logger.error("[AlertEngine] Failed for reminder %s: %s", reminder.id, exc)
        return False
