import uuid
from typing import Any

from pydantic import BaseModel, model_validator


class AssignmentCreate(BaseModel):
    user_id: uuid.UUID
    account_id: uuid.UUID
    program_id: uuid.UUID


class AssignmentUpdate(BaseModel):
    is_active: bool | None = None
    user_id: uuid.UUID | None = None


class AssignmentRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    account_id: uuid.UUID
    program_id: uuid.UUID
    is_active: bool
    account_name: str | None = None
    program_name: str | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_relationship_names(cls, obj: Any) -> Any:
        """Populate account_name and program_name from ORM relationships if loaded."""
        if hasattr(obj, "account") and obj.account is not None:
            obj.__dict__["account_name"] = obj.account.name
        if hasattr(obj, "program") and obj.program is not None:
            obj.__dict__["program_name"] = obj.program.name
        return obj


class AssignmentListResponse(BaseModel):
    items: list[AssignmentRead]
    total: int
