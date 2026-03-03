"""AI email generation endpoints."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import require_roles
from app.models.user import User
from app.schemas.generated_message import GenerateRequest, GeneratedMessageRead, SendRequest
from app.services import generate_service

router = APIRouter(prefix="/api/generate", tags=["generate"])


@router.post("", response_model=GeneratedMessageRead, status_code=201)
async def generate_email(
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    msg = await generate_service.generate_for_reminder(
        db,
        reminder_id=body.reminder_id,
        template_id=body.template_id,
        contact_id=body.contact_id,
        tone=body.tone,
        user_id=current_user.id,
    )
    return GeneratedMessageRead.model_validate(msg)


@router.post("/{message_id}/send", response_model=GeneratedMessageRead)
async def send_email(
    message_id: uuid.UUID,
    body: SendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm")),
):
    """Send a previously generated email to the specified recipient via SMTP."""
    msg = await generate_service.send_generated_message(
        db,
        message_id=message_id,
        recipient_email=body.recipient_email,
    )
    return GeneratedMessageRead.model_validate(msg)


@router.get("", response_model=list[GeneratedMessageRead])
async def list_generated(
    reminder_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "bdm", "director")),
):
    items = await generate_service.list_generated(db, reminder_id)
    return [GeneratedMessageRead.model_validate(m) for m in items]
