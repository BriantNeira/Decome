"""Async SMTP email sender for alert notifications."""
from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.models.email_config import EmailConfig
from app.utils.security import decrypt_field

logger = logging.getLogger(__name__)


async def send_alert_email(
    config: EmailConfig,
    *,
    to_email: str,
    subject: str,
    html_body: str,
) -> None:
    """Send a single HTML email via the configured SMTP server.

    Raises on any transport / auth error so the caller can log the failure.
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{config.from_name or 'Deminder'} <{config.from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    port = config.smtp_port or 587
    use_ssl = port == 465                      # direct SSL on 465
    start_tls = config.use_tls and not use_ssl  # STARTTLS on 587

    # Decrypt the stored password before using with SMTP
    raw_password = decrypt_field(config.smtp_password) if config.smtp_password else None

    await aiosmtplib.send(
        msg,
        hostname=config.smtp_host,
        port=port,
        use_tls=use_ssl,
        start_tls=start_tls,
        username=config.smtp_user or None,
        password=raw_password,
        timeout=15,
    )
    logger.info("Alert email sent to %s | %s", to_email, subject)


async def send_email(
    db,
    *,
    to_email: str,
    subject: str,
    html_body: str,
) -> str:
    """Unified email dispatch: tries Graph first, then SMTP fallback.

    Returns the provider used: 'graph' or 'smtp'.
    Raises HTTPException if no provider is configured/active.
    """
    from fastapi import HTTPException
    from app.services import graph_email_service
    from app.services.alert_service import get_email_config

    # 1. Try Microsoft Graph if active
    graph_config = await graph_email_service.get_graph_config(db)
    if graph_config and graph_config.is_active:
        try:
            await graph_email_service.send_graph_email(
                graph_config, to_email=to_email, subject=subject, html_body=html_body
            )
            return "graph"
        except Exception as exc:
            logger.warning("Graph email failed, falling back to SMTP: %s", exc)

    # 2. Fallback to SMTP
    smtp_config = await get_email_config(db)
    if smtp_config and smtp_config.is_active:
        await send_alert_email(
            smtp_config, to_email=to_email, subject=subject, html_body=html_body
        )
        return "smtp"

    raise HTTPException(
        status_code=422,
        detail="No email provider configured. Configure SMTP or Microsoft Graph in Email Settings.",
    )


def build_alert_email(reminder, alert_type: str) -> tuple[str, str]:
    """Return (subject, html_body) for the given reminder and alert type."""
    labels = {
        "7_day": "7-Day Reminder",
        "1_day": "1-Day Reminder",
        "overdue": "Overdue Reminder",
    }
    label = labels.get(alert_type, "Reminder Alert")

    account_name = reminder.account.name if reminder.account else "N/A"
    program_name = reminder.program.name if reminder.program else "—"
    bdm_name = reminder.user.full_name if reminder.user else "BDM"
    due_date = str(reminder.start_date)
    notes_row = (
        f"<tr><td style='padding:4px 12px 4px 0;color:#5E6060'>Notes</td>"
        f"<td style='padding:4px 0'>{reminder.notes}</td></tr>"
        if reminder.notes
        else ""
    )

    subject = f"Deminder — {label}: {reminder.title}"
    html_body = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#FAF9F7;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;border:1px solid #E7E5E4;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:#9AAE2F;padding:20px 32px">
            <span style="color:#fff;font-size:20px;font-weight:700">Deminder</span>
            <span style="color:#fff;font-size:13px;margin-left:12px;opacity:.85">{label}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:15px;color:#1C1D1D">Hi <strong>{bdm_name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#5E6060">
            This is an automated alert for the following reminder:
          </p>

          <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#1C1D1D;width:100%">
            <tr>
              <td style="padding:4px 12px 4px 0;color:#5E6060;white-space:nowrap">Title</td>
              <td style="padding:4px 0;font-weight:600">{reminder.title}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:#5E6060">Account</td>
              <td style="padding:4px 0">{account_name}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:#5E6060">Program</td>
              <td style="padding:4px 0">{program_name}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:#5E6060">Due Date</td>
              <td style="padding:4px 0">{due_date}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:#5E6060">Status</td>
              <td style="padding:4px 0;text-transform:capitalize">{reminder.status}</td>
            </tr>
            {notes_row}
          </table>

          <div style="margin-top:28px">
            <a href="http://localhost:3000/dashboard/reminders"
               style="display:inline-block;background:#9AAE2F;color:#fff;text-decoration:none;
                      padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600">
              View in Deminder →
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #E7E5E4">
            <p style="margin:0;font-size:12px;color:#9CA3AF">
              You are receiving this because you have an active reminder in Deminder.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    return subject, html_body
