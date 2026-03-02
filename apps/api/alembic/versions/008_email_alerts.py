"""email alerts — config + log tables

Revision ID: 008
Revises: 007
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Email configuration (singleton: always id=1) ──────────────────────
    op.create_table(
        "email_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("smtp_host", sa.String(255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True, server_default="587"),
        sa.Column("smtp_user", sa.String(255), nullable=True),
        sa.Column("smtp_password", sa.Text(), nullable=True),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("from_name", sa.String(255), nullable=True, server_default="Deminder"),
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    # ── Email alert logs ───────────────────────────────────────────────────
    op.create_table(
        "email_alert_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "reminder_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reminders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alert_type", sa.String(20), nullable=False),   # 7_day | 1_day | overdue
        sa.Column("sent_to", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="sent"),  # sent | failed
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )
    op.create_index("ix_email_alert_logs_reminder_id", "email_alert_logs", ["reminder_id"])
    op.create_index("ix_email_alert_logs_sent_at", "email_alert_logs", ["sent_at"])
    op.create_index("ix_email_alert_logs_status", "email_alert_logs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_email_alert_logs_status", table_name="email_alert_logs")
    op.drop_index("ix_email_alert_logs_sent_at", table_name="email_alert_logs")
    op.drop_index("ix_email_alert_logs_reminder_id", table_name="email_alert_logs")
    op.drop_table("email_alert_logs")
    op.drop_table("email_config")
