import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.account import Account
from app.models.contact import Contact
from app.models.program import Program


async def _load_contact(db: AsyncSession, contact_id: uuid.UUID) -> Contact:
    """Fetch a contact with account and programs pre-loaded."""
    result = await db.execute(
        select(Contact)
        .options(selectinload(Contact.account), selectinload(Contact.programs))
        .where(Contact.id == contact_id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


async def list_contacts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    account_id: uuid.UUID | None = None,
    account_ids: list[uuid.UUID] | None = None,
) -> tuple[list[Contact], int]:
    query = select(Contact).options(
        selectinload(Contact.account), selectinload(Contact.programs)
    )
    count_query = select(func.count()).select_from(Contact)

    if account_id:
        query = query.where(Contact.account_id == account_id)
        count_query = count_query.where(Contact.account_id == account_id)
    elif account_ids is not None:
        query = query.where(Contact.account_id.in_(account_ids))
        count_query = count_query.where(Contact.account_id.in_(account_ids))

    query = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    contacts = result.scalars().all()

    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    return list(contacts), total


async def get_contact(db: AsyncSession, contact_id: uuid.UUID) -> Contact:
    return await _load_contact(db, contact_id)


async def _sync_programs(db: AsyncSession, contact: Contact, program_ids: list[uuid.UUID]) -> None:
    """Replace contact's programs with the given list of program_ids."""
    # Ensure the programs collection is loaded before replacing (avoids lazy-load in async)
    await db.refresh(contact, ["programs"])

    if not program_ids:
        contact.programs = []
        return
    result = await db.execute(select(Program).where(Program.id.in_(program_ids)))
    programs = list(result.scalars().all())
    if len(programs) != len(program_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more program IDs are invalid",
        )
    contact.programs = programs


async def create_contact(
    db: AsyncSession,
    account_id: uuid.UUID,
    program_ids: list[uuid.UUID] | None = None,
    **fields,
) -> Contact:
    # Validate account exists
    acct_result = await db.execute(select(Account).where(Account.id == account_id))
    if not acct_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )

    contact = Contact(account_id=account_id, **fields)
    db.add(contact)
    await db.flush()

    if program_ids:
        await _sync_programs(db, contact, program_ids)
        await db.flush()

    return await _load_contact(db, contact.id)


async def update_contact_by_id(
    db: AsyncSession,
    contact_id: uuid.UUID,
    program_ids: list[uuid.UUID] | None = None,
    **fields,
) -> Contact:
    contact = await _load_contact(db, contact_id)

    for key, value in fields.items():
        if hasattr(contact, key) and value is not None:
            setattr(contact, key, value)

    if program_ids is not None:
        await _sync_programs(db, contact, program_ids)

    await db.flush()
    return await _load_contact(db, contact_id)


async def delete_contact_by_id(db: AsyncSession, contact_id: uuid.UUID) -> Contact:
    contact = await _load_contact(db, contact_id)
    await db.delete(contact)
    await db.flush()
    return contact
