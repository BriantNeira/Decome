import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.models.user import User
from app.utils.security import hash_password


async def list_users(
    db: AsyncSession, skip: int = 0, limit: int = 50, role: str | None = None
) -> tuple[list[User], int]:
    from sqlalchemy.orm import selectinload
    query = select(User).options(selectinload(User.role))
    count_query = select(func.count()).select_from(User)

    if role:
        query = query.join(User.role).where(Role.name == role)
        count_query = count_query.join(Role, User.role_id == Role.id).where(Role.name == role)

    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    result = await db.execute(query.offset(skip).limit(limit).order_by(User.created_at.desc()))
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


async def delete_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await get_user(db, user_id)
    await db.delete(user)
    await db.flush()
    return user
