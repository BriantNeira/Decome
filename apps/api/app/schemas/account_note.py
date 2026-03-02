import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class AccountNoteCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Note content cannot be empty")
        return v.strip()


class AccountNoteUpdate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Note content cannot be empty")
        return v.strip()


class AccountNoteRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    user_id: uuid.UUID
    content: str
    author_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountNoteListResponse(BaseModel):
    items: list[AccountNoteRead]
    total: int
