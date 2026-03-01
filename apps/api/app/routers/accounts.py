import uuid

from fastapi import APIRouter, Depends, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.account import (
    AccountCreate,
    AccountDetail,
    AccountListResponse,
    AccountRead,
    AssignmentSummary,
    ContactSummary,
    AccountNoteInDetail,
    AccountUpdate,
)
from app.services import account_service, audit_service

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    accounts, total = await account_service.list_accounts(db, skip=skip, limit=limit, search=search)
    return AccountListResponse(
        items=[AccountRead.model_validate(a) for a in accounts], total=total
    )


@router.get("/{account_id}", response_model=AccountDetail)
async def get_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    account = await account_service.get_account_detail(db, account_id)

    # Build enriched assignments
    assignments = []
    for a in account.assignments:
        assignments.append(AssignmentSummary(
            id=a.id,
            user_id=a.user_id,
            bdm_name=a.user.full_name if a.user else None,
            bdm_email=a.user.email if a.user else None,
            program_id=a.program_id,
            program_name=a.program.name if a.program else None,
            is_active=a.is_active,
        ))

    # Build contacts from account.contacts (Contact N:M Program already loaded)
    contacts = [ContactSummary.model_validate(c) for c in account.contacts]

    # Build notes
    notes = []
    for n in account.notes:
        notes.append(AccountNoteInDetail(
            id=n.id,
            user_id=n.user_id,
            author_name=n.author.full_name if n.author else None,
            content=n.content,
            created_at=n.created_at,
            updated_at=n.updated_at,
        ))

    return AccountDetail(
        id=account.id,
        name=account.name,
        code=account.code,
        description=account.description,
        is_active=account.is_active,
        logo_url=account.logo_url,
        assignments=assignments,
        contacts=contacts,
        notes=notes,
    )


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    account = await account_service.create_account(db, name=data.name, code=data.code, description=data.description)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "ACCOUNT_CREATED", user_id=current_user.id, resource_type="account", resource_id=str(account.id),
        details={"name": account.name, "code": account.code}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return AccountRead.model_validate(account)


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    account = await account_service.update_account(db, account_id, **data.model_dump(exclude_unset=True))
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "ACCOUNT_UPDATED", user_id=current_user.id, resource_type="account", resource_id=str(account_id),
        details=data.model_dump(exclude_unset=True), ip_address=ip, user_agent=ua
    )
    await db.commit()
    return AccountRead.model_validate(account)


@router.delete("/{account_id}", response_model=AccountRead)
async def delete_account(
    account_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    account = await account_service.delete_account(db, account_id)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "ACCOUNT_DELETED", user_id=current_user.id, resource_type="account", resource_id=str(account_id),
        details={}, ip_address=ip, user_agent=ua
    )
    await db.commit()
    return AccountRead.model_validate(account)


@router.post("/{account_id}/logo")
async def upload_account_logo(
    account_id: uuid.UUID,
    file: UploadFile,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    ip, ua = _client_info(request)
    result = await account_service.upload_logo(db, account_id, file)
    await audit_service.log_action(
        db, "ACCOUNT_LOGO_UPLOADED", user_id=current_user.id, resource_type="account",
        resource_id=str(account_id), details={"filename": result["filename"]},
        ip_address=ip, user_agent=ua,
    )
    await db.commit()
    return result


@router.delete("/{account_id}/logo")
async def delete_account_logo(
    account_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    ip, ua = _client_info(request)
    await account_service.delete_logo(db, account_id)
    await audit_service.log_action(
        db, "ACCOUNT_LOGO_DELETED", user_id=current_user.id, resource_type="account",
        resource_id=str(account_id), details={}, ip_address=ip, user_agent=ua,
    )
    await db.commit()
    return {"message": "Logo deleted."}


@router.get("/assets/{filename}")
async def serve_account_asset(filename: str):
    """Serve uploaded account logo assets (public)."""
    path = await account_service.get_asset_path(filename)
    return FileResponse(path)
