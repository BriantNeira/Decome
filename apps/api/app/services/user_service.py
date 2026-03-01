import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.models.user import User
from app.utils.security import hash_password


async def list_users(db: AsyncSession, skip: int = 0, limit: int = 50) -> tuple[list[User], int]:
    count_result = await db.execute(select(func.count()).select_from(User))
    total = count_result.scalar_one()

    result = await db.execute(select(User).offset(skip).limit(limit).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    return users, total


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    full_name: str | None = None,
    role_name: str | None = None,
    is_active: bool | None = None,
) -> User:
    user = await get_user(db, user_id)

    if full_name is not None:
        user.full_name = full_name

    if is_active is not None:
        user.is_active = is_active

    if role_name is not None:
        result = await db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{role_name}' not found.",
            )
        user.role_id = role.id

    return user


async def deactivate_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await get_user(db, user_id)
    user.is_active = False
    return user
