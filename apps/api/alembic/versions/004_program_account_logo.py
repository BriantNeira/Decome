"""004 program account_id and account logo_url

Revision ID: 004
Revises: 003
Create Date: 2026-03-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add account_id FK to programs (nullable — existing programs like N/A have no account)
    op.add_column(
        "programs",
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_programs_account_id", "programs", ["account_id"])

    # Add logo_url to accounts
    op.add_column(
        "accounts",
        sa.Column("logo_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "logo_url")
    op.drop_index("ix_programs_account_id", table_name="programs")
    op.drop_column("programs", "account_id")
