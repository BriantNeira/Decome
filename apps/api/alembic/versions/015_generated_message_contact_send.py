"""Add contact_id, sent_at, sent_to_email to generated_messages.

Revision ID: 015
Revises: 014
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "generated_messages",
        sa.Column(
            "contact_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_generated_messages_contact",
        "generated_messages", "contacts",
        ["contact_id"], ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "generated_messages",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "generated_messages",
        sa.Column("sent_to_email", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("generated_messages", "sent_to_email")
    op.drop_column("generated_messages", "sent_at")
    op.drop_constraint("fk_generated_messages_contact", "generated_messages", type_="foreignkey")
    op.drop_column("generated_messages", "contact_id")
