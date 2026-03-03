"""Add season to programs, completed_at to reminders.

Revision ID: 018
Revises: 017
Create Date: 2026-03-02
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programs", sa.Column("season", sa.String(255), nullable=True))
    op.add_column("reminders", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("reminders", "completed_at")
    op.drop_column("programs", "season")
