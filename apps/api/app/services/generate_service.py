"""Generate AI emails for reminders."""
from __future__ import annotations

import datetime
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.email_template import EmailTemplate
from app.models.generated_message import GeneratedMessage
from app.models.reminder import Reminder
from app.services import budget_service, llm_service, template_service


async def generate_for_reminder(
    db: AsyncSession,
    *,
    reminder_id: uuid.UUID,
    template_id: uuid.UUID | None,
    contact_id: uuid.UUID | None,
    tone: str,
    user_id: uuid.UUID,
) -> GeneratedMessage:
    # 1. Budget check
    await budget_service.check_budget(db, user_id)

    # 2. Load LLM config
    config = await llm_service.get_llm_config(db)
    if config is None or not config.is_active:
        raise HTTPException(status_code=422, detail="LLM is not configured or not active.")
    if not config.api_key:
        raise HTTPException(status_code=422, detail="LLM API key is not set.")

    # 3. Load reminder
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    reminder = result.scalar_one_or_none()
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")

    # 4. Load contact (if provided) to fill contact_name / contact_email
    contact_name = ""
    contact_email = ""
    resolved_contact_id = contact_id
    if contact_id is not None:
        c_result = await db.execute(select(Contact).where(Contact.id == contact_id))
        contact = c_result.scalar_one_or_none()
        if contact:
            first = contact.first_name or ""
            last = contact.last_name or ""
            contact_name = f"{first} {last}".strip()
            contact_email = contact.email or ""
        else:
            resolved_contact_id = None  # not found, don't store invalid FK

    # 5. Build template variables
    account_name = reminder.account.name if reminder.account else ""
    program_name = reminder.program.name if reminder.program else ""
    bdm_name = reminder.user.full_name if reminder.user else ""
    bdm_email = reminder.user.email if reminder.user else ""
    due_date = str(reminder.start_date)
    reminder_notes = reminder.notes or ""

    variables = {
        "account_name": account_name,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "program_name": program_name,
        "bdm_name": bdm_name,
        "bdm_email": bdm_email,
        "reminder_title": reminder.title,
        "reminder_notes": reminder_notes,
        "due_date": due_date,
    }

    # 6. Auto-select template by reminder type if no template_id provided
    resolved_template_id = template_id
    if template_id is None and reminder.type_id is not None:
        rt_result = await db.execute(
            select(EmailTemplate)
            .where(EmailTemplate.reminder_type_id == reminder.type_id)
            .where(EmailTemplate.is_active == True)  # noqa: E712
            .order_by(EmailTemplate.created_at.desc())
            .limit(1)
        )
        auto_tmpl = rt_result.scalar_one_or_none()
        if auto_tmpl is not None:
            resolved_template_id = auto_tmpl.id

    # 7. Render template (or build default scaffold if no template)
    if resolved_template_id:
        tmpl = await template_service.get_template(db, resolved_template_id)
        rendered_subject, rendered_body = template_service.render_template(tmpl, variables)
    else:
        recipient = contact_name or "{{contact_name}}"
        rendered_subject = f"Follow-up: {reminder.title}"
        rendered_body = (
            f"Dear {recipient},\n\n"
            f"This is a follow-up regarding {reminder.title}.\n\n"
            f"Due date: {due_date}\n\n"
            f"Best regards,\n{bdm_name}"
        )

    # 8. Load customer profile for LLM context
    profile_text: str | None = None
    try:
        from app.models.customer_profile import CustomerProfile
        cp_result = await db.execute(
            select(CustomerProfile)
            .where(CustomerProfile.account_id == reminder.account_id)
            .order_by(CustomerProfile.version.desc())
            .limit(1)
        )
        cp = cp_result.scalar_one_or_none()
        if cp:
            profile_text = cp.profile_text
    except Exception:
        pass  # customer profiles optional

    # 9. Call LLM
    subject, body, tokens_used = await llm_service.generate_email(
        config,
        rendered_subject=rendered_subject,
        rendered_body=rendered_body,
        tone=tone,
        profile_text=profile_text,
        reminder_title=reminder.title,
        due_date=due_date,
    )

    if not subject and not body:
        raise HTTPException(status_code=500, detail="LLM returned empty response.")

    # 10. Save generated message
    msg = GeneratedMessage(
        reminder_id=reminder_id,
        template_id=resolved_template_id,
        contact_id=resolved_contact_id,
        tone=tone,
        subject=subject,
        body=body,
        tokens_used=tokens_used,
        generated_by=user_id,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    # 11. Log token usage
    await budget_service.log_usage(
        db,
        user_id=user_id,
        account_id=reminder.account_id,
        reminder_id=reminder_id,
        tokens=tokens_used,
        provider=config.provider,
        model=config.model,
    )

    return msg


async def send_generated_message(
    db: AsyncSession,
    *,
    message_id: uuid.UUID,
    recipient_email: str,
) -> GeneratedMessage:
    """Send a previously generated email to the given recipient via email (Graph or SMTP)."""
    # Load the message (with its generator relationship)
    result = await db.execute(
        select(GeneratedMessage).where(GeneratedMessage.id == message_id)
    )
    msg = result.scalar_one_or_none()
    if msg is None:
        raise HTTPException(status_code=404, detail="Generated message not found")

    from app.services import email_service

    # Build HTML email from the LLM-generated plain text body
    html_body = _build_client_email_html(msg)

    try:
        # Use unified dispatch (Graph preferred, SMTP fallback)
        await email_service.send_email(
            db,
            to_email=recipient_email,
            subject=msg.subject,
            html_body=html_body,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send email: {exc}",
        ) from exc

    # Mark as sent
    msg.sent_at = datetime.datetime.now(datetime.timezone.utc)
    msg.sent_to_email = recipient_email
    await db.commit()
    await db.refresh(msg)

    return msg


def _build_client_email_html(msg: GeneratedMessage) -> str:
    """Convert the LLM plain-text body into a branded HTML email for the client."""
    # Escape HTML special chars and convert newlines to <br>
    import html as _html
    body_safe = _html.escape(msg.body)
    body_html = body_safe.replace("\n", "<br>")

    bdm_name = msg.generator.full_name if msg.generator else ""
    bdm_email = msg.generator.email if msg.generator else ""

    reply_to_line = (
        f'<a href="mailto:{_html.escape(bdm_email)}" style="color:#9AAE2F">'
        f"{_html.escape(bdm_email)}</a>"
        if bdm_email
        else ""
    )

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF9F7;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;border:1px solid #E7E5E4;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#9AAE2F;padding:18px 32px">
            <span style="color:#fff;font-size:18px;font-weight:700">Deminder</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;font-size:14px;color:#1C1D1D;line-height:1.7">
            {body_html}
          </td>
        </tr>

        <!-- BDM Signature -->
        <tr>
          <td style="padding:0 32px 28px;font-size:13px;color:#5E6060;border-top:1px solid #E7E5E4;padding-top:20px">
            <strong>{_html.escape(bdm_name)}</strong><br>
            {reply_to_line}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:14px 32px;border-top:1px solid #E7E5E4;background:#FAFAF9">
            <p style="margin:0;font-size:11px;color:#9CA3AF">Sent via Deminder</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def list_generated(db: AsyncSession, reminder_id: uuid.UUID) -> list[GeneratedMessage]:
    result = await db.execute(
        select(GeneratedMessage)
        .where(GeneratedMessage.reminder_id == reminder_id)
        .order_by(GeneratedMessage.generated_at.desc())
    )
    return list(result.scalars().all())
