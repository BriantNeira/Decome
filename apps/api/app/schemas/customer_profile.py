from __future__ import annotations
import uuid
import datetime
from typing import Optional
from pydantic import BaseModel


class CustomerProfileRead(BaseModel):
    id: int
    account_id: uuid.UUID
    profile_text: str
    version: int
    generated_at: datetime.datetime
    tokens_used: int
    generated_by: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}
