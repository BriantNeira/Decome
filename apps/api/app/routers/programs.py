import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.program import Program
from app.models.user import User
from app.schemas.program import (
    ProgramCreate,
    ProgramListResponse,
    ProgramRead,
    ProgramUpdate,
)
from app.services import program_service, audit_service

router = APIRouter(prefix="/api/programs", tags=["programs"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


async def _reload_program(db: AsyncSession, program_id: uuid.UUID) -> Program:
    """Reload program after commit to avoid async lazy-load errors on relationships."""
    result = await db.execute(select(Program).where(Program.id == program_id))
    return result.scalar_one()


@router.get("", response_model=ProgramListResponse)
async def list_programs(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    account_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    programs, total = await program_service.list_programs(
        db, skip=skip, limit=limit, search=search, account_id=account_id
    )
    return ProgramListResponse(
        items=[ProgramRead.model_validate(p) for p in programs], total=total
    )


@router.get("/{program_id}", response_model=ProgramRead)
async def get_program(
    program_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    program = await program_service.get_program(db, program_id)
    return ProgramRead.model_validate(program)


@router.post("", response_model=ProgramRead, status_code=status.HTTP_201_CREATED)
async def create_program(
    data: ProgramCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    program = await program_service.create_program(
        db, name=data.name, description=data.description, account_id=data.account_id
    )
    program_id = program.id
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "PROGRAM_CREATED", user_id=current_user.id, resource_type="program", resource_id=str(program_id),
        details={"name": program.name}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    # Reload after commit to avoid async lazy-load error on account relationship
    program = await _reload_program(db, program_id)
    return ProgramRead.model_validate(program)


@router.patch("/{program_id}", response_model=ProgramRead)
async def update_program(
    program_id: uuid.UUID,
    data: ProgramUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    program = await program_service.update_program(db, program_id, **data.model_dump(exclude_unset=True))
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "PROGRAM_UPDATED", user_id=current_user.id, resource_type="program", resource_id=str(program_id),
        details=data.model_dump(exclude_unset=True), ip_address=ip, user_agent=ua
    )
    await db.commit()
    # Reload after commit to avoid async lazy-load error on account relationship
    program = await _reload_program(db, program_id)
    return ProgramRead.model_validate(program)


@router.delete("/{program_id}", response_model=ProgramRead)
async def delete_program(
    program_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    program = await program_service.delete_program(db, program_id)
    snapshot = ProgramRead.model_validate(program)  # capture before flush/delete
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "PROGRAM_DELETED", user_id=current_user.id, resource_type="program", resource_id=str(program_id),
        details={}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return snapshot
