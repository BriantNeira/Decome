from __future__ import annotations
import uuid
import datetime
from pydantic import BaseModel, model_validator


class EmailTemplateRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    subject_template: str
    body_template: str
    is_active: bool
    reminder_type_id: int | None = None
    reminder_type_name: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_relationships(cls, obj):
        if hasattr(obj, "reminder_type") and obj.reminder_type:
            obj.__dict__["reminder_type_name"] = obj.reminder_type.name
        return obj


class EmailTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    subject_template: str
    body_template: str
    is_active: bool = True
    reminder_type_id: int | None = None


class EmailTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    subject_template: str | None = None
    body_template: str | None = None
    is_active: bool | None = None
    reminder_type_id: int | None = None


class EmailTemplateListResponse(BaseModel):
    items: list[EmailTemplateRead]
    total: int
