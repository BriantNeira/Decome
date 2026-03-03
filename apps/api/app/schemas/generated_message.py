from __future__ import annotations
import uuid
import datetime
from typing import Literal
from pydantic import BaseModel, model_validator


class GenerateRequest(BaseModel):
    reminder_id: uuid.UUID
    template_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    tone: Literal["formal", "friendly", "direct"] = "formal"


class MessageUpdateRequest(BaseModel):
    subject: str | None = None
    body: str | None = None


class SendRequest(BaseModel):
    recipient_email: str


class GeneratedMessageRead(BaseModel):
    id: uuid.UUID
    reminder_id: uuid.UUID
    template_id: uuid.UUID | None
    contact_id: uuid.UUID | None = None
    contact_name: str | None = None
    tone: str
    subject: str
    body: str
    tokens_used: int
    generated_at: datetime.datetime
    generated_by: uuid.UUID
    sent_at: datetime.datetime | None = None
    sent_to_email: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_relationships(cls, obj):
        if hasattr(obj, "contact") and obj.contact is not None:
            first = obj.contact.first_name or ""
            last = obj.contact.last_name or ""
            full = f"{first} {last}".strip()
            obj.__dict__["contact_name"] = full or None
        else:
            if not hasattr(obj, "__dict__") or "contact_name" not in obj.__dict__:
                if hasattr(obj, "__dict__"):
                    obj.__dict__.setdefault("contact_name", None)
        return obj
