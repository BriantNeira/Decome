"""contact restructure: person fields + contact_programs junction

Revision ID: 006
Revises: 005
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop FK constraint and index on assignment_id, then drop column
    op.drop_constraint("fk_contacts_assignment_id", "contacts", type_="foreignkey")
    op.drop_index("ix_contacts_assignment_id", table_name="contacts")
    op.drop_column("contacts", "assignment_id")

    # 2. Drop old contact fields
    op.drop_column("contacts", "primary_contact_name")
    op.drop_column("contacts", "primary_contact_email")
    op.drop_column("contacts", "decision_maker_name")
    op.drop_column("contacts", "decision_maker_email")

    # 3. Add new person fields
    op.add_column("contacts", sa.Column("title", sa.String(20), nullable=True))
    op.add_column("contacts", sa.Column("first_name", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("last_name", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("phone", sa.String(100), nullable=True))
    op.add_column(
        "contacts",
        sa.Column("is_decision_maker", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 4. Create contact_programs junction table
    op.create_table(
        "contact_programs",
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("contact_id", "program_id"),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    # Drop junction table
    op.drop_table("contact_programs")

    # Remove new fields
    op.drop_column("contacts", "is_decision_maker")
    op.drop_column("contacts", "phone")
    op.drop_column("contacts", "email")
    op.drop_column("contacts", "last_name")
    op.drop_column("contacts", "first_name")
    op.drop_column("contacts", "title")

    # Restore old fields
    op.add_column("contacts", sa.Column("primary_contact_name", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("primary_contact_email", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("decision_maker_name", sa.String(255), nullable=True))
    op.add_column("contacts", sa.Column("decision_maker_email", sa.String(255), nullable=True))

    # Restore assignment_id column
    op.add_column(
        "contacts",
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_contacts_assignment_id", "contacts", ["assignment_id"])
    op.create_foreign_key(
        "fk_contacts_assignment_id",
        "contacts",
        "assignments",
        ["assignment_id"],
        ["id"],
        ondelete="SET NULL",
    )
