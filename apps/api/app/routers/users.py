import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.user import UserListResponse, UserRead, UserSelfUpdate, UserUpdate
from app.services import audit_service, user_service

router = APIRouter(prefix="/api/users", tags=["users"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    ua = request.headers.get("User-Agent")
    return ip, ua


@router.get("", response_model=UserListResponse)
async def list_users(
    skip: int = 0,
    limit: int = 50,
    role: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    users, total = await user_service.list_users(db, skip=skip, limit=limit, role=role)
    return UserListResponse(
        items=[
            UserRead(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role.name,
                is_active=u.is_active,
                totp_enabled=u.totp_enabled,
            )
            for u in users
        ],
        total=total,
    )


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: UserSelfUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow any authenticated user to update their own display name."""
    if body.full_name is not None:
        current_user.full_name = body.full_name
        await db.flush()
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db,
        action="USER_UPDATED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(current_user.id),
        details=body.model_dump(exclude_none=True),
        ip_address=ip,
        user_agent=ua,
    )
    await db.commit()
    await db.refresh(current_user)
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.name,
        is_active=current_user.is_active,
        totp_enabled=current_user.totp_enabled,
    )


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    user = await user_service.get_user(db, user_id)
    return UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.name,
        is_active=user.is_active,
        totp_enabled=user.totp_enabled,
    )


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    user = await user_service.update_user(
        db,
        user_id=user_id,
        full_name=body.full_name,
        role_name=body.role,
        is_active=body.is_active,
    )
    await audit_service.log_action(
        db,
        action="USER_UPDATED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details=body.model_dump(exclude_none=True),
        ip_address=ip,
        user_agent=ua,
    )
    return UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.name,
        is_active=user.is_active,
        totp_enabled=user.totp_enabled,
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )
    ip, ua = _client_info(request)
    user = await user_service.delete_user(db, user_id)
    await audit_service.log_action(
        db,
        action="USER_DELETED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user_id),
        details={"email": user.email},
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": f"User {user.email} deleted."}
