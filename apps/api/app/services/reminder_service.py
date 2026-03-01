import datetime
import uuid
from calendar import monthrange

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder


async def _load_reminder(db: AsyncSession, reminder_id: uuid.UUID) -> Reminder:
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.scalar_one_or_none()
    if reminder is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    return reminder


async def create_reminder(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    title: str,
    start_date: datetime.date,
    program_id: uuid.UUID | None = None,
    type_id: int | None = None,
    notes: str | None = None,
    recurrence_rule: str | None = None,
) -> Reminder:
    reminder = Reminder(
        user_id=user_id,
        account_id=account_id,
        program_id=program_id,
        type_id=type_id,
        title=title,
        notes=notes,
        start_date=start_date,
        recurrence_rule=recurrence_rule,
        status="open",
        edit_count=0,
    )
    db.add(reminder)
    await db.flush()
    await db.refresh(reminder)
    return reminder


async def list_reminders(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    user_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    status: str | None = None,
) -> tuple[list[Reminder], int]:
    query = select(Reminder)
    if user_id:
        query = query.where(Reminder.user_id == user_id)
    if account_id:
        query = query.where(Reminder.account_id == account_id)
    if status == "overdue":
        today = datetime.date.today()
        query = query.where(
            Reminder.status.in_(["open", "in_progress"]),
            Reminder.start_date < today,
        )
    elif status:
        query = query.where(Reminder.status == status)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.order_by(Reminder.start_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def get_reminder(db: AsyncSession, reminder_id: uuid.UUID) -> Reminder:
    return await _load_reminder(db, reminder_id)


async def update_reminder(
    db: AsyncSession,
    reminder_id: uuid.UUID,
    **fields,
) -> Reminder:
    reminder = await _load_reminder(db, reminder_id)
    for key, value in fields.items():
        setattr(reminder, key, value)
    reminder.edit_count = (reminder.edit_count or 0) + 1
    reminder.updated_at = datetime.datetime.now(datetime.UTC)
    await db.flush()
    await db.refresh(reminder)
    return reminder


async def delete_reminder(db: AsyncSession, reminder_id: uuid.UUID) -> Reminder:
    reminder = await _load_reminder(db, reminder_id)
    await db.delete(reminder)
    return reminder


async def get_stats(
    db: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
) -> dict:
    today = datetime.date.today()
    first_of_month = today.replace(day=1)
    # Convert to UTC-aware datetime for comparison with timestamptz
    first_of_month_dt = datetime.datetime.combine(first_of_month, datetime.time.min).replace(
        tzinfo=datetime.timezone.utc
    )

    def base_query():
        q = select(func.count()).select_from(Reminder)
        if user_id:
            q = q.where(Reminder.user_id == user_id)
        return q

    open_result = await db.execute(base_query().where(Reminder.status == "open"))
    in_progress_result = await db.execute(base_query().where(Reminder.status == "in_progress"))
    overdue_result = await db.execute(
        base_query()
        .where(Reminder.status.in_(["open", "in_progress"]))
        .where(Reminder.start_date < today)
    )
    completed_result = await db.execute(
        base_query()
        .where(Reminder.status == "completed")
        .where(Reminder.updated_at >= first_of_month_dt)
    )

    return {
        "open": open_result.scalar_one(),
        "in_progress": in_progress_result.scalar_one(),
        "overdue": overdue_result.scalar_one(),
        "completed_this_month": completed_result.scalar_one(),
    }


async def list_for_calendar(
    db: AsyncSession,
    *,
    year: int,
    month: int,
    user_id: uuid.UUID | None = None,
) -> list[dict]:
    """Return reminders expanded for the given year/month (recurring ones expanded into occurrences)."""
    # First day and last day of the requested month
    _, last_day = monthrange(year, month)
    month_start = datetime.date(year, month, 1)
    month_end = datetime.date(year, month, last_day)

    # Fetch candidates: non-recurring that fall in month, or any recurring
    query = select(Reminder)
    if user_id:
        query = query.where(Reminder.user_id == user_id)
    query = query.where(
        (
            (Reminder.recurrence_rule.is_(None)) & (Reminder.start_date >= month_start) & (Reminder.start_date <= month_end)
        )
        | (Reminder.recurrence_rule.isnot(None))
    )
    result = await db.execute(query)
    reminders = list(result.scalars().all())

    expanded: list[dict] = []
    for r in reminders:
        if r.recurrence_rule is None:
            # non-recurring — already filtered to month
            expanded.append({"reminder": r, "occurrence_date": r.start_date})
        else:
            # Compute occurrences within month
            occurrences = _compute_occurrences(r.start_date, r.recurrence_rule, month_start, month_end)
            for occ_date in occurrences:
                expanded.append({"reminder": r, "occurrence_date": occ_date})

    return expanded


def _compute_occurrences(
    start_date: datetime.date,
    rule: str,
    month_start: datetime.date,
    month_end: datetime.date,
) -> list[datetime.date]:
    """Compute all occurrence dates for a recurring reminder within [month_start, month_end]."""
    occurrences = []

    if rule == "DAILY":
        delta = datetime.timedelta(days=1)
    elif rule == "WEEKLY":
        delta = datetime.timedelta(weeks=1)
    elif rule == "BIWEEKLY":
        delta = datetime.timedelta(weeks=2)
    elif rule == "MONTHLY":
        # Special case: same day of month
        current = start_date
        while current <= month_end:
            if current >= month_start:
                occurrences.append(current)
            # Advance by one month
            next_month = current.month + 1
            next_year = current.year
            if next_month > 12:
                next_month = 1
                next_year += 1
            # Use same day-of-month, clamped to valid date
            _, last = monthrange(next_year, next_month)
            next_day = min(current.day, last)
            current = datetime.date(next_year, next_month, next_day)
        return occurrences
    else:
        return []

    # For DAILY/WEEKLY/BIWEEKLY
    current = start_date
    # Fast-forward to first occurrence >= month_start
    if current < month_start:
        diff = (month_start - current).days
        steps = diff // delta.days
        current = current + delta * steps
        if current < month_start:
            current += delta

    while current <= month_end:
        occurrences.append(current)
        current += delta

    return occurrences
