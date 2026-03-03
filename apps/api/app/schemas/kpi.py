from __future__ import annotations
import datetime
from pydantic import BaseModel


class KPITypeSummary(BaseModel):
    type_id: int | None = None
    type_name: str
    type_color: str | None = None
    total: int
    completed: int
    overdue: int


class KPIAccountSummary(BaseModel):
    account_id: str
    account_name: str
    total: int
    completed: int
    overdue: int
    on_time_pct: float


class KPIProgramSummary(BaseModel):
    program_id: str | None = None
    program_name: str
    account_name: str
    total: int
    completed: int
    overdue: int


class KPIBDMSummary(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    total: int
    completed: int
    overdue: int
    tokens_used: int
    messages_generated: int


class KPITokenBDM(BaseModel):
    name: str
    tokens: int
    messages: int


class KPITokenSummary(BaseModel):
    total_tokens: int
    by_bdm: list[KPITokenBDM]


class KPISummary(BaseModel):
    date_from: str
    date_to: str
    completed_on_time: int
    completed_late: int
    completion_rate: float
    overdue_pending: int
    total_open: int
    total_completed: int
    by_type: list[KPITypeSummary]
    by_account: list[KPIAccountSummary]
    by_program: list[KPIProgramSummary]
    by_bdm: list[KPIBDMSummary]
    token_summary: KPITokenSummary


class DiagnosisRequest(BaseModel):
    date_from: str
    date_to: str
    account_id: str | None = None


class DiagnosisResponse(BaseModel):
    diagnosis: str
    tokens_used: int
