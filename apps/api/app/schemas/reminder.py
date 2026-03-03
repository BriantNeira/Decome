import datetime
import uuid

from pydantic import BaseModel, model_validator


class ReminderCreate(BaseModel):
    user_id: uuid.UUID
    account_id: uuid.UUID
    program_id: uuid.UUID | None = None
    type_id: int | None = None
    title: str
    notes: str | None = None
    start_date: datetime.date
    recurrence_rule: str | None = None  # DAILY / WEEKLY / BIWEEKLY / MONTHLY


class ReminderUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    status: str | None = None  # open / in_progress / completed / cancelled
    start_date: datetime.date | None = None
    recurrence_rule: str | None = None
    type_id: int | None = None
    program_id: uuid.UUID | None = None


class ReminderRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    account_id: uuid.UUID
    account_name: str | None = None
    program_id: uuid.UUID | None = None
    program_name: str | None = None
    type_id: int | None = None
    type_name: str | None = None
    type_color: str | None = None
    title: str
    notes: str | None = None
    status: str
    start_date: datetime.date
    recurrence_rule: str | None = None
    edit_count: int
    completed_at: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def extract_relationships(cls, obj):
        if hasattr(obj, "user") and obj.user:
            obj.__dict__["user_name"] = obj.user.full_name
        if hasattr(obj, "account") and obj.account:
            obj.__dict__["account_name"] = obj.account.name
        if hasattr(obj, "program") and obj.program:
            obj.__dict__["program_name"] = obj.program.name
        if hasattr(obj, "reminder_type") and obj.reminder_type:
            obj.__dict__["type_name"] = obj.reminder_type.name
            obj.__dict__["type_color"] = obj.reminder_type.color
        return obj


class ReminderListResponse(BaseModel):
    items: list[ReminderRead]
    total: int


class ReminderStats(BaseModel):
    open: int
    in_progress: int
    overdue: int
    completed_this_month: int


class CalendarReminder(ReminderRead):
    occurrence_date: datetime.date
