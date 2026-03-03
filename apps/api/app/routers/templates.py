"""Email template CRUD (admin manages, all roles read)."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.email_template import (
    EmailTemplateCreate,
    EmailTemplateListResponse,
    EmailTemplateRead,
    EmailTemplateUpdate,
)
from app.services import template_service

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=EmailTemplateListResponse)
async def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = await template_service.list_templates(db, skip=skip, limit=limit, active_only=active_only)
    return EmailTemplateListResponse(
        items=[EmailTemplateRead.model_validate(t) for t in items],
        total=total,
    )


@router.post("", response_model=EmailTemplateRead, status_code=201)
async def create_template(
    body: EmailTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = await template_service.create_template(db, **body.model_dump())
    return EmailTemplateRead.model_validate(obj)


@router.get("/{template_id}", response_model=EmailTemplateRead)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = await template_service.get_template(db, template_id)
    return EmailTemplateRead.model_validate(obj)


@router.patch("/{template_id}", response_model=EmailTemplateRead)
async def update_template(
    template_id: uuid.UUID,
    body: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = await template_service.update_template(db, template_id, **body.model_dump(exclude_none=True))
    return EmailTemplateRead.model_validate(obj)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    await template_service.delete_template(db, template_id)
