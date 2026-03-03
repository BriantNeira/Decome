import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentListResponse,
    AssignmentRead,
    AssignmentUpdate,
)
from app.services import assignment_service, audit_service

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


@router.get("", response_model=AssignmentListResponse)
async def list_assignments(
    skip: int = 0,
    limit: int = 50,
    user_id: uuid.UUID | None = None,
    account_id: uuid.UUID | None = None,
    program_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    assignments, total = await assignment_service.list_assignments(
        db, skip=skip, limit=limit, user_id=user_id, account_id=account_id, program_id=program_id
    )
    return AssignmentListResponse(
        items=[AssignmentRead.model_validate(a) for a in assignments], total=total
    )


@router.get("/my", response_model=AssignmentListResponse)
async def list_my_assignments(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("bdm")),
):
    assignments, total = await assignment_service.list_my_assignments(
        db, current_user.id, skip=skip, limit=limit
    )
    return AssignmentListResponse(
        items=[AssignmentRead.model_validate(a) for a in assignments], total=total
    )


@router.get("/{assignment_id}", response_model=AssignmentRead)
async def get_assignment(
    assignment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    assignment = await assignment_service.get_assignment(db, assignment_id)
    return AssignmentRead.model_validate(assignment)


@router.post("", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    assignment = await assignment_service.create_assignment(
        db, user_id=data.user_id, account_id=data.account_id, program_id=data.program_id
    )
    # Build response before commit (relationships are loaded now, expired after commit)
    response = AssignmentRead.model_validate(assignment)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db,
        "ASSIGNMENT_CREATED",
        user_id=current_user.id,
        resource_type="assignment",
        resource_id=str(assignment.id),
        details={"user_id": str(assignment.user_id), "account_id": str(assignment.account_id), "program_id": str(assignment.program_id)},
        ip_address=ip,
        user_agent=ua,
    )
    await db.commit()
    return response


@router.patch("/{assignment_id}", response_model=AssignmentRead)
async def update_assignment(
    assignment_id: uuid.UUID,
    data: AssignmentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    assignment = await assignment_service.update_assignment(
        db, assignment_id, **data.model_dump(exclude_unset=True)
    )
    # Build response before commit (relationships are loaded now, expired after commit)
    response = AssignmentRead.model_validate(assignment)
    ip, ua = _client_info(request)
    audit_details = {k: str(v) if hasattr(v, "__str__") else v for k, v in data.model_dump(exclude_unset=True).items()}
    await audit_service.log_action(
        db, "ASSIGNMENT_UPDATED", user_id=current_user.id, resource_type="assignment", resource_id=str(assignment_id),
        details=audit_details, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return response


@router.delete("/{assignment_id}", response_model=AssignmentRead)
async def delete_assignment(
    assignment_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    assignment = await assignment_service.delete_assignment(db, assignment_id)
    # Build response before commit (relationships are loaded now, expired after commit)
    response = AssignmentRead.model_validate(assignment)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "ASSIGNMENT_DELETED", user_id=current_user.id, resource_type="assignment", resource_id=str(assignment_id),
        details={}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return response
