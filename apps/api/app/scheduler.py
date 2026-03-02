"""APScheduler setup — runs hourly email alert checks."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


async def _run_alert_checks() -> None:
    """Scheduled task: open a DB session and run all alert checks."""
    from app.database import async_session_factory
    from app.services import alert_service

    async with async_session_factory() as db:
        try:
            result = await alert_service.run_alert_checks(db)
            await db.commit()
            logger.info("[Scheduler] Alert check complete: %s", result)
        except Exception as exc:
            await db.rollback()
            logger.error("[Scheduler] Alert check error: %s", exc)


def start_scheduler() -> None:
    scheduler.add_job(
        _run_alert_checks,
        trigger="interval",
        hours=1,
        id="email_alerts",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[Scheduler] Started — email alerts every 1 hour")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")
