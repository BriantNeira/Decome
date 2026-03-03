"""Bulk import from Excel (.xlsx) — reminders and multi-entity."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user, require_roles
from app.models.user import User
from app.services import import_service

router = APIRouter(tags=["imports"])

MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB

VALID_ENTITY_TYPES = {"accounts", "programs", "contacts", "assignments", "reminders"}


class ImportRowResult(BaseModel):
    row_num: int
    status: str  # "ok" | "error" | "skipped"
    error_msg: Optional[str] = None
    account: str = ""
    program: str = ""
    reminder_type: str = ""
    title: str = ""
    due_date: str = ""
    reminder_id: Optional[str] = None
    entity_name: Optional[str] = None


class ImportResponse(BaseModel):
    total_rows: int
    valid_rows: int
    error_rows: int
    skipped_rows: int = 0
    rows: list[ImportRowResult]
    created: int = 0


# ---------------------------------------------------------------------------
# Legacy endpoints (keep existing paths working)
# ---------------------------------------------------------------------------

@router.get("/api/reminders/import/template")
async def download_reminder_template(
    current_user: User = Depends(get_current_user),
):
    """Download the .xlsx import template for reminders (legacy endpoint)."""
    xlsx_bytes = import_service.generate_template_xlsx()
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reminder_import_template.xlsx"},
    )


@router.post("/api/reminders/import", response_model=ImportResponse)
async def import_reminders_legacy(
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="If true, validate only (no records created)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    """
    Upload a .xlsx file to bulk-create reminders (legacy endpoint).

    - `dry_run=true` (default): validate and preview, no records saved
    - `dry_run=false`: create reminders for all valid rows
    """
    return await _import_reminders(file, dry_run, db, current_user)


# ---------------------------------------------------------------------------
# New multi-entity endpoints
# ---------------------------------------------------------------------------

@router.get("/api/import/{entity_type}/template")
async def download_entity_template(
    entity_type: str,
    current_user: User = Depends(get_current_user),
):
    """Download the .xlsx import template for the given entity type."""
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type '{entity_type}'. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}",
        )

    if entity_type == "reminders":
        xlsx_bytes = import_service.generate_template_xlsx()
        filename = "reminder_import_template.xlsx"
    else:
        xlsx_bytes = import_service.generate_entity_template_xlsx(entity_type)
        filename = f"{entity_type}_import_template.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/api/import/{entity_type}", response_model=ImportResponse)
async def import_entities(
    entity_type: str,
    file: UploadFile = File(...),
    dry_run: bool = Query(True, description="If true, validate only (no records created)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    """
    Upload a .xlsx file to bulk-import entities.

    - `entity_type`: accounts, programs, contacts, assignments, reminders
    - `dry_run=true` (default): validate and preview, no records saved
    - `dry_run=false`: create entities for all valid rows
    """
    if entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type '{entity_type}'. Must be one of: {', '.join(sorted(VALID_ENTITY_TYPES))}",
        )

    if entity_type == "reminders":
        return await _import_reminders(file, dry_run, db, current_user)

    # --- Multi-entity import ---
    _validate_upload(file)
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")

    try:
        rows = await import_service.parse_and_validate_entities(db, content, entity_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    valid_rows = [r for r in rows if r.status == "ok"]
    error_rows = [r for r in rows if r.status == "error"]
    skipped_rows = [r for r in rows if r.status == "skipped"]
    created_count = 0

    if not dry_run and valid_rows:
        await import_service.create_entities_from_rows(db, rows, entity_type, current_user.id)
        created_count = len(valid_rows)

    row_results = [
        ImportRowResult(
            row_num=r.row_num,
            status=r.status,
            error_msg=r.error_msg,
            account=r.account,
            program=r.program,
            reminder_type=r.reminder_type,
            title=r.title,
            due_date=str(r.due_date) if r.due_date else r.due_date_raw,
            reminder_id=str(r.reminder_id) if r.reminder_id else None,
            entity_name=r.entity_name,
        )
        for r in rows
    ]

    return ImportResponse(
        total_rows=len(rows),
        valid_rows=len(valid_rows),
        error_rows=len(error_rows),
        skipped_rows=len(skipped_rows),
        rows=row_results,
        created=created_count,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_upload(file: UploadFile):
    """Validate that the upload is an xlsx file."""
    if file.content_type not in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        if not (file.filename or "").lower().endswith(".xlsx"):
            raise HTTPException(status_code=400, detail="Only .xlsx files are accepted.")


async def _import_reminders(
    file: UploadFile,
    dry_run: bool,
    db: AsyncSession,
    current_user: User,
) -> ImportResponse:
    """Shared logic for reminder imports (used by both legacy and new endpoints)."""
    _validate_upload(file)
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")

    try:
        rows = await import_service.parse_and_validate(db, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    valid_rows = [r for r in rows if r.status == "ok"]
    error_rows = [r for r in rows if r.status == "error"]
    created_count = 0

    if not dry_run and valid_rows:
        await import_service.create_from_rows(db, valid_rows, current_user.id)
        created_count = len(valid_rows)

    row_results = [
        ImportRowResult(
            row_num=r.row_num,
            status=r.status,
            error_msg=r.error_msg,
            account=r.account,
            program=r.program,
            reminder_type=r.reminder_type,
            title=r.title,
            due_date=str(r.due_date) if r.due_date else r.due_date_raw,
            reminder_id=str(r.reminder_id) if r.reminder_id else None,
            entity_name=r.entity_name,
        )
        for r in rows
    ]

    return ImportResponse(
        total_rows=len(rows),
        valid_rows=len(valid_rows),
        error_rows=len(error_rows),
        rows=row_results,
        created=created_count,
    )
