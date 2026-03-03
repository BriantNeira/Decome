from __future__ import annotations
import uuid
import datetime
from typing import Optional
from pydantic import BaseModel


class AccountKnowledgeRead(BaseModel):
    account_id: uuid.UUID
    website: Optional[str] = None
    main_email: Optional[str] = None
    industry: Optional[str] = None
    account_type: Optional[str] = None
    observations: Optional[str] = None
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class AccountKnowledgeUpdate(BaseModel):
    website: Optional[str] = None
    main_email: Optional[str] = None
    industry: Optional[str] = None
    account_type: Optional[str] = None
    observations: Optional[str] = None
