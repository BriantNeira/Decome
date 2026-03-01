import uuid

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.account_note import (
    AccountNoteCreate,
    AccountNoteListResponse,
    AccountNoteRead,
    AccountNoteUpdate,
)
from app.services import account_note_service, audit_service

router = APIRouter(prefix="/api/accounts/{account_id}/notes", tags=["account-notes"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


def _note_read(note) -> AccountNoteRead:
    """Build AccountNoteRead, resolving author_name from the relationship."""
    author_name = None
    if note.author:
        author_name = note.author.full_name or note.author.email
    return AccountNoteRead(
        id=note.id,
        account_id=note.account_id,
        user_id=note.user_id,
        content=note.content,
        author_name=author_name,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("", response_model=AccountNoteListResponse)
async def list_notes(
    account_id: uuid.UUID,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    notes, total = await account_note_service.list_notes(db, account_id, skip=skip, limit=limit)
    return AccountNoteListResponse(items=[_note_read(n) for n in notes], total=total)


@router.post("", response_model=AccountNoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(
    account_id: uuid.UUID,
    data: AccountNoteCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    note = await account_note_service.create_note(
        db, account_id=account_id, user_id=current_user.id, content=data.content
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "NOTE_CREATED", user_id=current_user.id, resource_type="account_note",
        resource_id=str(note.id), details={"account_id": str(account_id)}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return _note_read(note)


@router.patch("/{note_id}", response_model=AccountNoteRead)
async def update_note(
    account_id: uuid.UUID,
    note_id: uuid.UUID,
    data: AccountNoteUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    note = await account_note_service.update_note(
        db, note_id=note_id, current_user_id=current_user.id, content=data.content
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "NOTE_UPDATED", user_id=current_user.id, resource_type="account_note",
        resource_id=str(note_id), details={"account_id": str(account_id)}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return _note_read(note)


@router.delete("/{note_id}", response_model=AccountNoteRead)
async def delete_note(
    account_id: uuid.UUID,
    note_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    is_admin = current_user.role.name == "admin" if current_user.role else False
    note = await account_note_service.delete_note(
        db, note_id=note_id, current_user_id=current_user.id, is_admin=is_admin
    )
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "NOTE_DELETED", user_id=current_user.id, resource_type="account_note",
        resource_id=str(note_id), details={"account_id": str(account_id)}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return _note_read(note)
