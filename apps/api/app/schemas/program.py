import uuid
from typing import Any

from pydantic import BaseModel, model_validator


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None
    season: str | None = None
    account_id: uuid.UUID | None = None


class ProgramUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    season: str | None = None
    is_active: bool | None = None


class ProgramRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_default: bool
    is_active: bool
    season: str | None = None
    account_id: uuid.UUID | None = None
    account_name: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_account_name(cls, obj: Any) -> Any:
        if hasattr(obj, "account") and obj.account is not None:
            obj.__dict__["account_name"] = obj.account.name
        return obj


class ProgramListResponse(BaseModel):
    items: list[ProgramRead]
    total: int
