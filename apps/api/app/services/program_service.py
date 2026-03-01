from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.program import Program
from app.models.assignment import Assignment


async def list_programs(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    account_id: str | None = None,
) -> tuple[list[Program], int]:
    query = select(Program)
    if search:
        query = query.where(Program.name.ilike(f"%{search}%"))
    if account_id:
        query = query.where(Program.account_id == account_id)

    count_result = await db.execute(select(func.count()).select_from(Program))
    total = count_result.scalar() or 0

    result = await db.execute(query.offset(skip).limit(limit))
    programs = result.scalars().all()
    return programs, total


async def get_program(db: AsyncSession, program_id: str) -> Program:
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return program


async def create_program(
    db: AsyncSession,
    name: str,
    description: str | None = None,
    account_id: str | None = None,
) -> Program:
    existing = await db.execute(select(Program).where(Program.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Program name already exists"
        )

    program = Program(name=name, description=description, account_id=account_id)
    db.add(program)
    await db.flush()
    return program


async def update_program(db: AsyncSession, program_id: str, **fields) -> Program:
    program = await get_program(db, program_id)

    if program.is_default and "name" in fields and fields["name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot rename the default program",
        )

    if "name" in fields and fields["name"]:
        existing = await db.execute(
            select(Program).where(Program.name == fields["name"], Program.id != program_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Program name already exists"
            )

    for key, value in fields.items():
        if hasattr(program, key) and value is not None:
            setattr(program, key, value)

    await db.flush()
    return program


async def delete_program(db: AsyncSession, program_id: str) -> Program:
    program = await get_program(db, program_id)

    if program.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete the default program"
        )

    result = await db.execute(
        select(Assignment).where(
            Assignment.program_id == program_id, Assignment.is_active == True
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete program with active assignments",
        )

    await db.delete(program)
    await db.flush()
    return program
