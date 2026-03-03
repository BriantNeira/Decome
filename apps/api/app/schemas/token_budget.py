from __future__ import annotations
import uuid
from typing import Optional
from pydantic import BaseModel


class TokenBudgetRead(BaseModel):
    id: int
    user_id: uuid.UUID
    monthly_limit: int

    model_config = {"from_attributes": True}


class TokenBudgetCreate(BaseModel):
    user_id: uuid.UUID
    monthly_limit: int = 0


class TokenBudgetUpdate(BaseModel):
    monthly_limit: int


class BudgetUsageSummary(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    monthly_limit: int
    tokens_used_this_month: int
    remaining: Optional[int]
    budget_id: Optional[int]
