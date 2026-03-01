from pydantic import BaseModel, field_validator


class CustomFieldDefinitionCreate(BaseModel):
    field_name: str
    field_type: str  # "text" | "number" | "date" | "boolean" | "dropdown"
    entity_type: str  # "account" | "assignment" | "contact"
    is_required: bool = False
    options: dict | None = None
    sort_order: int = 0

    @field_validator("field_type")
    @classmethod
    def valid_field_type(cls, v: str) -> str:
        if v not in ("text", "number", "date", "boolean", "dropdown"):
            raise ValueError(
                "field_type must be text, number, date, boolean, or dropdown."
            )
        return v

    @field_validator("entity_type")
    @classmethod
    def valid_entity_type(cls, v: str) -> str:
        if v not in ("account", "assignment", "contact"):
            raise ValueError("entity_type must be account, assignment, or contact.")
        return v


class CustomFieldDefinitionUpdate(BaseModel):
    field_name: str | None = None
    is_required: bool | None = None
    options: dict | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CustomFieldDefinitionRead(BaseModel):
    id: int
    field_name: str
    field_type: str
    entity_type: str
    is_required: bool
    options: dict | None
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class CustomFieldDefinitionListResponse(BaseModel):
    items: list[CustomFieldDefinitionRead]
    total: int


class CustomFieldValueSet(BaseModel):
    definition_id: int
    value: str | None = None


class CustomFieldValueRead(BaseModel):
    definition_id: int
    field_name: str
    field_type: str
    value: str | None

    model_config = {"from_attributes": True}
