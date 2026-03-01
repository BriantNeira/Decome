import uuid
from typing import Any

from pydantic import BaseModel, model_validator


class ContactCreate(BaseModel):
    account_id: uuid.UUID
    title: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_decision_maker: bool = False
    program_ids: list[uuid.UUID] = []


class ContactUpdate(BaseModel):
    title: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_decision_maker: bool | None = None
    program_ids: list[uuid.UUID] | None = None


class ContactRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    account_name: str | None = None
    title: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    is_decision_maker: bool
    program_ids: list[uuid.UUID] = []
    program_names: list[str] = []

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_relationships(cls, obj: Any) -> Any:
        if hasattr(obj, "account") and obj.account is not None:
            obj.__dict__["account_name"] = obj.account.name
        if hasattr(obj, "programs"):
            obj.__dict__["program_ids"] = [p.id for p in obj.programs]
            obj.__dict__["program_names"] = [p.name for p in obj.programs]
        return obj


class ContactListResponse(BaseModel):
    items: list[ContactRead]
    total: int
