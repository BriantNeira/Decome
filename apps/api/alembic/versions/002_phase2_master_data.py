"""add phase2 master data tables

Revision ID: 002
Revises: 001
Create Date: 2026-03-01 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create accounts table
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("code", sa.String(100), nullable=True),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_accounts_code"),
    )
    op.create_index("ix_accounts_name", "accounts", ["name"])

    # Create programs table
    op.create_table(
        "programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_programs_name"),
    )

    # Create assignments table
    op.create_table(
        "assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["program_id"], ["programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "account_id",
            "program_id",
            name="uq_assignment_user_account_program",
        ),
    )
    op.create_index("ix_assignments_user_id", "assignments", ["user_id"])
    op.create_index("ix_assignments_account_id", "assignments", ["account_id"])
    op.create_index("ix_assignments_program_id", "assignments", ["program_id"])

    # Create contacts table
    op.create_table(
        "contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("primary_contact_name", sa.String(255), nullable=True),
        sa.Column("primary_contact_email", sa.String(255), nullable=True),
        sa.Column("decision_maker_name", sa.String(255), nullable=True),
        sa.Column("decision_maker_email", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assignment_id", name="uq_contacts_assignment_id"),
    )
    op.create_index("ix_contacts_assignment_id", "contacts", ["assignment_id"])

    # Create reminder_types table
    op.create_table(
        "reminder_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("color", sa.String(7), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_reminder_types_name"),
    )

    # Create custom_field_definitions table
    op.create_table(
        "custom_field_definitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column(
            "field_type",
            postgresql.ENUM("text", "number", "date", "boolean", "dropdown", name="field_type_enum"),
            nullable=False,
        ),
        sa.Column(
            "entity_type",
            postgresql.ENUM("account", "assignment", "contact", name="entity_type_enum"),
            nullable=False,
        ),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create custom_field_values table
    op.create_table(
        "custom_field_values",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("definition_id", sa.Integer(), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=False),
        sa.Column("value", sa.String(2000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["definition_id"],
            ["custom_field_definitions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_custom_field_values_definition_id", "custom_field_values", ["definition_id"])
    op.create_index("ix_custom_field_values_entity_id", "custom_field_values", ["entity_id"])


def downgrade() -> None:
    op.drop_index("ix_custom_field_values_entity_id", table_name="custom_field_values")
    op.drop_index("ix_custom_field_values_definition_id", table_name="custom_field_values")
    op.drop_table("custom_field_values")
    op.drop_table("custom_field_definitions")

    op.drop_table("reminder_types")
    op.drop_index("ix_contacts_assignment_id", table_name="contacts")
    op.drop_table("contacts")
    op.drop_index("ix_assignments_program_id", table_name="assignments")
    op.drop_index("ix_assignments_account_id", table_name="assignments")
    op.drop_index("ix_assignments_user_id", table_name="assignments")
    op.drop_table("assignments")
    op.drop_table("programs")
    op.drop_index("ix_accounts_name", table_name="accounts")
    op.drop_table("accounts")
