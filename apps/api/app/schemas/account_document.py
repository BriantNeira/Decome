from __future__ import annotations
import uuid
import datetime
from pydantic import BaseModel


class AccountDocumentRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    filename: str
    file_type: str
    uploaded_at: datetime.datetime
    uploaded_by_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_uploader(cls, doc) -> "AccountDocumentRead":
        return cls(
            id=doc.id,
            account_id=doc.account_id,
            filename=doc.filename,
            file_type=doc.file_type,
            uploaded_at=doc.uploaded_at,
            uploaded_by_name=doc.uploader.full_name if doc.uploader else None,
        )
