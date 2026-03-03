from __future__ import annotations
import datetime
from pydantic import BaseModel


class LLMConfigRead(BaseModel):
    provider: str
    model: str
    api_key_set: bool
    max_tokens_per_request: int
    is_active: bool
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class LLMConfigUpdate(BaseModel):
    provider: str | None = None
    api_key: str | None = None
    model: str | None = None
    max_tokens_per_request: int | None = None
    is_active: bool | None = None
