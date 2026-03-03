"""Phase 7: Link email_templates to reminder_types (optional FK)

Revision ID: 014
Revises: 013
Create Date: 2026-03-02

"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_templates",
        sa.Column("reminder_type_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_email_templates_reminder_type",
        "email_templates",
        "reminder_types",
        ["reminder_type_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_email_templates_reminder_type",
        "email_templates",
        type_="foreignkey",
    )
    op.drop_column("email_templates", "reminder_type_id")
