from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.reminder_type import ReminderType


async def list_reminder_types(
    db: AsyncSession, skip: int = 0, limit: int = 50
) -> tuple[list[ReminderType], int]:
    count_result = await db.execute(select(func.count()).select_from(ReminderType))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(ReminderType).order_by(ReminderType.id).offset(skip).limit(limit)
    )
    types = result.scalars().all()
    return types, total


async def get_reminder_type(db: AsyncSession, type_id: int) -> ReminderType:
    result = await db.execute(select(ReminderType).where(ReminderType.id == type_id))
    reminder_type = result.scalar_one_or_none()
    if not reminder_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reminder type not found"
        )
    return reminder_type


async def create_reminder_type(
    db: AsyncSession, name: str, description: str | None = None, color: str | None = None
) -> ReminderType:
    existing = await db.execute(select(ReminderType).where(ReminderType.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Reminder type name already exists"
        )

    reminder_type = ReminderType(name=name, description=description, color=color)
    db.add(reminder_type)
    await db.flush()
    return reminder_type


async def update_reminder_type(db: AsyncSession, type_id: int, **fields) -> ReminderType:
    reminder_type = await get_reminder_type(db, type_id)

    if "name" in fields and fields["name"]:
        existing = await db.execute(
            select(ReminderType).where(ReminderType.name == fields["name"], ReminderType.id != type_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Reminder type name already exists"
            )

    for key, value in fields.items():
        if hasattr(reminder_type, key) and value is not None:
            setattr(reminder_type, key, value)

    await db.flush()
    return reminder_type


async def delete_reminder_type(db: AsyncSession, type_id: int) -> ReminderType:
    reminder_type = await get_reminder_type(db, type_id)
    await db.delete(reminder_type)
    await db.flush()
    return reminder_type
