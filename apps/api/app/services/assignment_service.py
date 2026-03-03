import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.account import Account
from app.models.assignment import Assignment
from app.models.program import Program
from app.models.user import User


async def _load_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment:
    """Fetch an assignment by ID with relationships pre-loaded."""
    result = await db.execute(
        select(Assignment)
        .options(
            selectinload(Assignment.user),
            selectinload(Assignment.account),
            selectinload(Assignment.program),
        )
        .where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )
    return assignment


async def list_assignments(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    user_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    program_id: uuid.UUID | None = None,
) -> tuple[list[Assignment], int]:
    query = select(Assignment).options(
        selectinload(Assignment.user),
        selectinload(Assignment.account),
        selectinload(Assignment.program),
    )

    if user_id:
        query = query.where(Assignment.user_id == user_id)
    if account_id:
        query = query.where(Assignment.account_id == account_id)
    if program_id:
        query = query.where(Assignment.program_id == program_id)

    count_result = await db.execute(select(func.count()).select_from(Assignment))
    total = count_result.scalar() or 0

    result = await db.execute(query.offset(skip).limit(limit))
    assignments = list(result.scalars().all())
    return assignments, total


async def get_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment:
    return await _load_assignment(db, assignment_id)


async def create_assignment(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, program_id: uuid.UUID
) -> Assignment:
    # Validate user exists and is BDM
    user_result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if not user.role or user.role.name != "bdm":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must have BDM role",
        )

    # Validate account and program exist
    acct_result = await db.execute(select(Account).where(Account.id == account_id))
    if not acct_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )

    prog_result = await db.execute(select(Program).where(Program.id == program_id))
    if not prog_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    # Check unique constraint: one program per account
    # A program can only be assigned to one BDM in a given account
    existing = await db.execute(
        select(Assignment).where(
            Assignment.program_id == program_id,
            Assignment.account_id == account_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This program is already assigned in this account. Assign it to a different BDM in another account.",
        )

    assignment = Assignment(user_id=user_id, account_id=account_id, program_id=program_id)
    db.add(assignment)
    await db.flush()
    return await _load_assignment(db, assignment.id)


async def update_assignment(
    db: AsyncSession,
    assignment_id: uuid.UUID,
    is_active: bool | None = None,
    user_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    program_id: uuid.UUID | None = None,
) -> Assignment:
    assignment = await _load_assignment(db, assignment_id)

    if is_active is not None:
        assignment.is_active = is_active

    if user_id is not None:
        # Validate new user exists and has BDM role
        user_result = await db.execute(
            select(User).options(selectinload(User.role)).where(User.id == user_id)
        )
        new_user = user_result.scalar_one_or_none()
        if not new_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        if not new_user.role or new_user.role.name != "bdm":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must have BDM role",
            )
        assignment.user_id = user_id

    if account_id is not None:
        acct_result = await db.execute(select(Account).where(Account.id == account_id))
        if not acct_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
            )
        assignment.account_id = account_id

    if program_id is not None:
        prog_result = await db.execute(select(Program).where(Program.id == program_id))
        if not prog_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
            )
        assignment.program_id = program_id

    # Check new (program_id, account_id) doesn't conflict with another assignment
    # A program can only be assigned to one BDM in a given account
    conflict_result = await db.execute(
        select(Assignment).where(
            Assignment.program_id == assignment.program_id,
            Assignment.account_id == assignment.account_id,
            Assignment.id != assignment_id,
        )
    )
    if conflict_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This program is already assigned to a different BDM in this account.",
        )

    await db.flush()
    return await _load_assignment(db, assignment_id)


async def delete_assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment:
    assignment = await _load_assignment(db, assignment_id)
    await db.delete(assignment)
    await db.flush()
    return assignment


async def list_my_assignments(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> tuple[list[Assignment], int]:
    query = (
        select(Assignment)
        .options(
            selectinload(Assignment.user),
            selectinload(Assignment.account),
            selectinload(Assignment.program),
        )
        .where(Assignment.user_id == user_id, Assignment.is_active == True)
    )

    count_result = await db.execute(
        select(func.count()).select_from(Assignment).where(Assignment.user_id == user_id)
    )
    total = count_result.scalar() or 0

    result = await db.execute(query.offset(skip).limit(limit))
    assignments = list(result.scalars().all())
    return assignments, total
