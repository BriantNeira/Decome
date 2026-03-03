"""Email template CRUD + variable rendering."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_template import EmailTemplate

TEMPLATE_VARIABLES = [
    "account_name",
    "contact_name",
    "contact_email",
    "program_name",
    "bdm_name",
    "reminder_title",
    "reminder_notes",
    "due_date",
]


async def list_templates(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    active_only: bool = False,
) -> tuple[list[EmailTemplate], int]:
    q = select(EmailTemplate)
    if active_only:
        q = q.where(EmailTemplate.is_active.is_(True))
    total_result = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_result.scalar_one()
    rows = await db.execute(q.order_by(EmailTemplate.name).offset(skip).limit(limit))
    return list(rows.scalars().all()), total


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> EmailTemplate:
    result = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template not found")
    return obj


async def create_template(db: AsyncSession, **fields) -> EmailTemplate:
    obj = EmailTemplate(**fields)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_template(db: AsyncSession, template_id: uuid.UUID, **fields) -> EmailTemplate:
    obj = await get_template(db, template_id)
    for k, v in fields.items():
        setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_template(db: AsyncSession, template_id: uuid.UUID) -> None:
    obj = await get_template(db, template_id)
    await db.delete(obj)
    await db.commit()


def render_template(template: EmailTemplate, variables: dict) -> tuple[str, str]:
    """Replace {{variable}} tokens in subject and body. Returns (subject, body)."""
    subject = template.subject_template
    body = template.body_template
    for key, value in variables.items():
        placeholder = "{{" + key + "}}"
        subject = subject.replace(placeholder, str(value) if value else "")
        body = body.replace(placeholder, str(value) if value else "")
    return subject, body
