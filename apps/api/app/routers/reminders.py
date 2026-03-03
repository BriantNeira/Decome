import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.reminder import (
    CalendarReminder,
    ReminderCreate,
    ReminderListResponse,
    ReminderRead,
    ReminderStats,
    ReminderUpdate,
)
from app.services import audit_service, reminder_service

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


def _is_bdm(user: User) -> bool:
    return user.role.name == "bdm"


def _check_ownership(reminder, current_user: User) -> None:
    """Raise 403 if BDM tries to access a reminder they don't own."""
    if _is_bdm(current_user) and reminder.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


@router.get("/stats", response_model=ReminderStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    uid = current_user.id if _is_bdm(current_user) else None
    stats = await reminder_service.get_stats(db, user_id=uid)
    return ReminderStats(**stats)


@router.get("/calendar", response_model=list[CalendarReminder])
async def list_calendar(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    uid = current_user.id if _is_bdm(current_user) else None
    expanded = await reminder_service.list_for_calendar(db, year=year, month=month, user_id=uid)
    result = []
    for item in expanded:
        r = item["reminder"]
        occ_date = item["occurrence_date"]
        read = ReminderRead.model_validate(r)
        cal = CalendarReminder(**read.model_dump(), occurrence_date=occ_date)
        result.append(cal)
    return result


@router.get("", response_model=ReminderListResponse)
async def list_reminders(
    skip: int = 0,
    limit: int = 50,
    account_id: uuid.UUID | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    uid = current_user.id if _is_bdm(current_user) else None
    reminders, total = await reminder_service.list_reminders(
        db, skip=skip, limit=limit, user_id=uid, account_id=account_id, status=status
    )
    return ReminderListResponse(
        items=[ReminderRead.model_validate(r) for r in reminders], total=total
    )


@router.get("/{reminder_id}", response_model=ReminderRead)
async def get_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    reminder = await reminder_service.get_reminder(db, reminder_id)
    _check_ownership(reminder, current_user)
    return ReminderRead.model_validate(reminder)


@router.post("", response_model=ReminderRead, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    # BDM can only create reminders for themselves
    user_id = current_user.id if _is_bdm(current_user) else data.user_id
    reminder = await reminder_service.create_reminder(
        db,
        user_id=user_id,
        account_id=data.account_id,
        program_id=data.program_id,
        type_id=data.type_id,
        title=data.title,
        notes=data.notes,
        start_date=data.start_date,
        recurrence_rule=data.recurrence_rule,
    )
    response = ReminderRead.model_validate(reminder)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db,
        "REMINDER_CREATED",
        user_id=current_user.id,
        resource_type="reminder",
        resource_id=str(reminder.id),
        details={"title": reminder.title, "account_id": str(reminder.account_id), "start_date": str(reminder.start_date)},
        ip_address=ip,
        user_agent=ua,
    )
    await db.commit()
    return response


@router.patch("/{reminder_id}", response_model=ReminderRead)
async def update_reminder(
    reminder_id: uuid.UUID,
    data: ReminderUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    reminder = await reminder_service.get_reminder(db, reminder_id)
    _check_ownership(reminder, current_user)

    update_fields = data.model_dump(exclude_unset=True)

    # Track completed_at timestamp
    if "status" in update_fields:
        new_status = update_fields["status"]
        old_status = reminder.status
        if new_status == "completed" and old_status != "completed":
            update_fields["completed_at"] = datetime.datetime.now(datetime.timezone.utc)
        elif new_status != "completed" and old_status == "completed":
            update_fields["completed_at"] = None

    reminder = await reminder_service.update_reminder(
        db, reminder_id, **update_fields
    )
    response = ReminderRead.model_validate(reminder)
    ip, ua = _client_info(request)
    audit_details = {k: str(v) for k, v in data.model_dump(exclude_unset=True).items()}
    await audit_service.log_action(
        db,
        "REMINDER_UPDATED",
        user_id=current_user.id,
        resource_type="reminder",
        resource_id=str(reminder_id),
        details=audit_details,
        ip_address=ip,
        user_agent=ua,
    )
    await db.commit()
    return response


@router.delete("/{reminder_id}", response_model=ReminderRead)
async def delete_reminder(
    reminder_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    reminder = await reminder_service.get_reminder(db, reminder_id)
    _check_ownership(reminder, current_user)
    reminder = await reminder_service.delete_reminder(db, reminder_id)
    response = ReminderRead.model_validate(reminder)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db,
        "REMINDER_DELETED",
        user_id=current_user.id,
        resource_type="reminder",
        resource_id=str(reminder_id),
        details={},
        ip_address=ip,
        user_agent=ua,
    )
    await db.commit()
    return response
