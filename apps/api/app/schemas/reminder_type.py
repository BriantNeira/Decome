from pydantic import BaseModel


class ReminderTypeCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None


class ReminderTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    is_active: bool | None = None


class ReminderTypeRead(BaseModel):
    id: int
    name: str
    description: str | None
    color: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class ReminderTypeListResponse(BaseModel):
    items: list[ReminderTypeRead]
    total: int
