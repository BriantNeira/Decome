"""KPI dashboard endpoints — summary, Excel export, AI diagnosis."""
import uuid

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import require_roles
from app.models.user import User
from app.schemas.kpi import DiagnosisRequest, DiagnosisResponse, KPISummary
from app.services import kpi_service

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("", response_model=KPISummary)
async def get_kpis(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    account_id: uuid.UUID | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    bdm_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    return await kpi_service.get_kpi_summary(
        db,
        date_from=date_from,
        date_to=date_to,
        account_id=account_id,
        program_id=program_id,
        bdm_id=bdm_id,
    )


@router.get("/export")
async def export_kpis(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    account_id: uuid.UUID | None = Query(None),
    program_id: uuid.UUID | None = Query(None),
    bdm_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    data = await kpi_service.export_calendar_excel(
        db,
        date_from=date_from,
        date_to=date_to,
        account_id=account_id,
        program_id=program_id,
        bdm_id=bdm_id,
    )
    filename = f"kpi_report_{date_from}_{date_to}.xlsx"
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/diagnosis", response_model=DiagnosisResponse)
async def ai_diagnosis(
    body: DiagnosisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "director")),
):
    acct_id = uuid.UUID(body.account_id) if body.account_id else None
    diagnosis_text, tokens_used = await kpi_service.generate_ai_diagnosis(
        db,
        user_id=current_user.id,
        date_from=body.date_from,
        date_to=body.date_to,
        account_id=acct_id,
    )
    return DiagnosisResponse(diagnosis=diagnosis_text, tokens_used=tokens_used)
