from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.reminder_type import (
    ReminderTypeCreate,
    ReminderTypeListResponse,
    ReminderTypeRead,
    ReminderTypeUpdate,
)
from app.services import reminder_type_service, audit_service

router = APIRouter(prefix="/api/reminder-types", tags=["reminder-types"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


@router.get("", response_model=ReminderTypeListResponse)
async def list_reminder_types(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    types, total = await reminder_type_service.list_reminder_types(db, skip=skip, limit=limit)
    return ReminderTypeListResponse(
        items=[ReminderTypeRead.model_validate(t) for t in types], total=total
    )


@router.get("/{type_id}", response_model=ReminderTypeRead)
async def get_reminder_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    reminder_type = await reminder_type_service.get_reminder_type(db, type_id)
    return ReminderTypeRead.model_validate(reminder_type)


@router.post("", response_model=ReminderTypeRead, status_code=status.HTTP_201_CREATED)
async def create_reminder_type(
    data: ReminderTypeCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    reminder_type = await reminder_type_service.create_reminder_type(
        db, name=data.name, description=data.description, color=data.color
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "REMINDER_TYPE_CREATED", user_id=current_user.id, resource_type="reminder_type", resource_id=str(reminder_type.id),
        details={"name": reminder_type.name}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return ReminderTypeRead.model_validate(reminder_type)


@router.patch("/{type_id}", response_model=ReminderTypeRead)
async def update_reminder_type(
    type_id: int,
    data: ReminderTypeUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    reminder_type = await reminder_type_service.update_reminder_type(
        db, type_id, **data.model_dump(exclude_unset=True)
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "REMINDER_TYPE_UPDATED", user_id=current_user.id, resource_type="reminder_type", resource_id=str(type_id),
        details=data.model_dump(exclude_unset=True), ip_address=ip, user_agent=ua
    )
    await db.commit()
    return ReminderTypeRead.model_validate(reminder_type)


@router.delete("/{type_id}", response_model=ReminderTypeRead)
async def delete_reminder_type(
    type_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    reminder_type = await reminder_type_service.delete_reminder_type(db, type_id)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "REMINDER_TYPE_DELETED", user_id=current_user.id, resource_type="reminder_type", resource_id=str(type_id),
        details={}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return ReminderTypeRead.model_validate(reminder_type)
