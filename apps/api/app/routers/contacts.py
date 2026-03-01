import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.middleware.rbac import require_roles
from app.models.assignment import Assignment
from app.models.user import User
from app.schemas.contact import (
    ContactCreate,
    ContactListResponse,
    ContactRead,
    ContactUpdate,
)
from app.services import audit_service, contact_service

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent")
    return ip, ua


async def _bdm_account_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    """Return account IDs where this BDM has active assignments."""
    result = await db.execute(
        select(Assignment.account_id)
        .where(Assignment.user_id == user_id, Assignment.is_active == True)
        .distinct()
    )
    return [row[0] for row in result.all()]


async def _bdm_can_access_account(db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID) -> bool:
    """Check if a BDM has an active assignment for the given account."""
    result = await db.execute(
        select(Assignment.id)
        .where(
            Assignment.user_id == user_id,
            Assignment.account_id == account_id,
            Assignment.is_active == True,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    skip: int = 0,
    limit: int = 50,
    account_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    role_name = current_user.role.name if current_user.role else ""

    if role_name == "bdm":
        allowed_ids = await _bdm_account_ids(db, current_user.id)
        if account_id:
            if account_id not in allowed_ids:
                return ContactListResponse(items=[], total=0)
            contacts, total = await contact_service.list_contacts(
                db, skip=skip, limit=limit, account_id=account_id
            )
        else:
            contacts, total = await contact_service.list_contacts(
                db, skip=skip, limit=limit, account_ids=allowed_ids
            )
    else:
        contacts, total = await contact_service.list_contacts(
            db, skip=skip, limit=limit, account_id=account_id
        )

    return ContactListResponse(
        items=[ContactRead.model_validate(c) for c in contacts],
        total=total,
    )


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
async def create_contact(
    data: ContactCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    role_name = current_user.role.name if current_user.role else ""
    if role_name == "bdm":
        if not await _bdm_can_access_account(db, current_user.id, data.account_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create contacts for accounts you are assigned to",
            )

    fields = data.model_dump(exclude={"account_id", "program_ids"})
    contact = await contact_service.create_contact(
        db,
        account_id=data.account_id,
        program_ids=data.program_ids,
        **fields,
    )
    # Build response before commit (relationships are loaded now, expired after commit)
    response = ContactRead.model_validate(contact)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CONTACT_CREATED", user_id=current_user.id, resource_type="contact",
        resource_id=str(contact.id),
        details={"account_id": str(data.account_id), "name": f"{data.first_name} {data.last_name}"},
        ip_address=ip, user_agent=ua,
    )
    await db.commit()
    return response


@router.get("/{contact_id}", response_model=ContactRead)
async def get_contact(
    contact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    contact = await contact_service.get_contact(db, contact_id)

    role_name = current_user.role.name if current_user.role else ""
    if role_name == "bdm":
        if not await _bdm_can_access_account(db, current_user.id, contact.account_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view contacts for accounts you are assigned to",
            )

    return ContactRead.model_validate(contact)


@router.patch("/{contact_id}", response_model=ContactRead)
async def update_contact(
    contact_id: uuid.UUID,
    data: ContactUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    contact = await contact_service.get_contact(db, contact_id)

    role_name = current_user.role.name if current_user.role else ""
    if role_name == "bdm":
        if not await _bdm_can_access_account(db, current_user.id, contact.account_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit contacts for accounts you are assigned to",
            )

    fields = data.model_dump(exclude_unset=True)
    program_ids = fields.pop("program_ids", None)
    updated = await contact_service.update_contact_by_id(
        db, contact_id, program_ids=program_ids, **fields
    )
    # Build response before commit (relationships are loaded now, expired after commit)
    response = ContactRead.model_validate(updated)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CONTACT_UPDATED", user_id=current_user.id, resource_type="contact",
        resource_id=str(contact_id),
        details=data.model_dump(exclude_unset=True, mode="json"),
        ip_address=ip, user_agent=ua,
    )
    await db.commit()
    return response


@router.delete("/{contact_id}", response_model=ContactRead)
async def delete_contact(
    contact_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    contact = await contact_service.delete_contact_by_id(db, contact_id)
    # Build response before commit (relationships are loaded now, expired after commit)
    response = ContactRead.model_validate(contact)
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db, "CONTACT_DELETED", user_id=current_user.id, resource_type="contact",
        resource_id=str(contact_id), details={},
        ip_address=ip, user_agent=ua,
    )
    await db.commit()
    return response
