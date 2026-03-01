import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.account_note import AccountNote


async def list_notes(
    db: AsyncSession,
    account_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[AccountNote], int]:
    """List all notes for an account."""
    # Verify account exists
    acc = await db.get(Account, account_id)
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    total_result = await db.execute(
        select(func.count()).where(AccountNote.account_id == account_id)
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(AccountNote)
        .options(selectinload(AccountNote.author))
        .where(AccountNote.account_id == account_id)
        .order_by(AccountNote.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    notes = list(result.scalars().all())
    return notes, total


async def get_note(db: AsyncSession, note_id: uuid.UUID) -> AccountNote:
    result = await db.execute(
        select(AccountNote)
        .options(selectinload(AccountNote.author))
        .where(AccountNote.id == note_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


async def create_note(
    db: AsyncSession,
    account_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str,
) -> AccountNote:
    """BDM creates a note on an account."""
    acc = await db.get(Account, account_id)
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    note = AccountNote(account_id=account_id, user_id=user_id, content=content)
    db.add(note)
    await db.flush()
    # Re-fetch to properly load the author relationship via selectinload
    return await get_note(db, note.id)


async def update_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    current_user_id: uuid.UUID,
    content: str,
) -> AccountNote:
    """BDM can only edit their own notes."""
    note = await get_note(db, note_id)
    if note.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own notes",
        )
    note.content = content
    await db.flush()
    # Re-fetch to ensure the updated note + author are properly loaded
    return await get_note(db, note_id)


async def delete_note(
    db: AsyncSession,
    note_id: uuid.UUID,
    current_user_id: uuid.UUID,
    is_admin: bool = False,
) -> AccountNote:
    """BDMs can only delete their own notes; admins can delete any."""
    note = await get_note(db, note_id)
    if not is_admin and note.user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own notes",
        )
    await db.delete(note)
    await db.flush()
    return note
