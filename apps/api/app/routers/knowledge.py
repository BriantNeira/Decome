"""Knowledge base endpoints: documents, structured fields, customer profiles."""
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.account_document import AccountDocumentRead
from app.schemas.account_knowledge import AccountKnowledgeRead, AccountKnowledgeUpdate
from app.schemas.customer_profile import CustomerProfileRead
from app.services import knowledge_service

router = APIRouter(prefix="/api/accounts", tags=["knowledge"])


# ── Documents ─────────────────────────────────────────────────────────────────

@router.get("/{account_id}/documents", response_model=list[AccountDocumentRead])
async def list_documents(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = await knowledge_service.list_documents(db, account_id)
    return [AccountDocumentRead.from_orm_with_uploader(d) for d in docs]


@router.post("/{account_id}/documents", response_model=AccountDocumentRead, status_code=201)
async def upload_document(
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    doc = await knowledge_service.upload_document(db, account_id, file, current_user.id)
    return AccountDocumentRead.from_orm_with_uploader(doc)


@router.delete("/{account_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    account_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    await knowledge_service.delete_document(db, doc_id)


# ── Structured Knowledge ───────────────────────────────────────────────────────

@router.get("/{account_id}/knowledge", response_model=AccountKnowledgeRead | None)
async def get_knowledge(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await knowledge_service.get_knowledge(db, account_id)
    if obj is None:
        return None
    return AccountKnowledgeRead.model_validate(obj)


@router.put("/{account_id}/knowledge", response_model=AccountKnowledgeRead)
async def upsert_knowledge(
    account_id: uuid.UUID,
    body: AccountKnowledgeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    obj = await knowledge_service.upsert_knowledge(
        db, account_id, current_user.id, **body.model_dump(exclude_none=True)
    )
    return AccountKnowledgeRead.model_validate(obj)


# ── Customer Profile ───────────────────────────────────────────────────────────

@router.get("/{account_id}/profile", response_model=CustomerProfileRead | None)
async def get_profile(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await knowledge_service.get_latest_profile(db, account_id)
    if obj is None:
        return None
    return CustomerProfileRead.model_validate(obj)


@router.post("/{account_id}/profile/build", response_model=CustomerProfileRead, status_code=201)
async def build_profile(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    profile = await knowledge_service.build_profile(db, account_id, current_user.id)
    return CustomerProfileRead.model_validate(profile)


@router.get("/{account_id}/profile/history", response_model=list[CustomerProfileRead])
async def profile_history(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = await knowledge_service.list_profile_history(db, account_id)
    return [CustomerProfileRead.model_validate(p) for p in items]
