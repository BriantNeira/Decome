"""Create graph_email_config table for Microsoft Graph email provider.

Revision ID: 017
Revises: 016
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "graph_email_config",
        sa.Column("id", sa.Integer(), primary_key=True, default=1),
        sa.Column("tenant_id", sa.String(255), nullable=True),
        sa.Column("client_id", sa.String(255), nullable=True),
        sa.Column("client_secret", sa.Text(), nullable=True),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("graph_email_config")
