import uuid
from datetime import datetime

from pydantic import BaseModel


class AccountCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    is_active: bool | None = None


class AccountRead(BaseModel):
    id: uuid.UUID
    name: str
    code: str | None
    description: str | None
    is_active: bool
    logo_url: str | None = None

    model_config = {"from_attributes": True}


class AccountListResponse(BaseModel):
    items: list[AccountRead]
    total: int


# ── Detail view (used in account detail page) ──────────────────────────────────

class ContactSummary(BaseModel):
    id: uuid.UUID
    title: str | None
    first_name: str | None
    last_name: str | None
    email: str | None
    is_decision_maker: bool

    model_config = {"from_attributes": True}


class AssignmentSummary(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    bdm_name: str | None = None
    bdm_email: str | None = None
    program_id: uuid.UUID
    program_name: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class AccountNoteInDetail(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    author_name: str | None = None
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountDetail(BaseModel):
    id: uuid.UUID
    name: str
    code: str | None
    description: str | None
    is_active: bool
    logo_url: str | None = None
    assignments: list[AssignmentSummary] = []
    contacts: list[ContactSummary] = []
    notes: list[AccountNoteInDetail] = []

    model_config = {"from_attributes": True}
