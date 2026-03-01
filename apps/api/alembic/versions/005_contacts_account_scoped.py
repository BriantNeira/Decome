"""contacts account scoped

Revision ID: 005
Revises: 004
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add account_id column as nullable first (so we can populate it)
    op.add_column(
        "contacts",
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
    )

    # 2. Populate account_id from the related assignment's account_id
    op.execute(
        """
        UPDATE contacts
        SET account_id = assignments.account_id
        FROM assignments
        WHERE assignments.id = contacts.assignment_id
        """
    )

    # 3. Create FK constraint and index on account_id
    op.create_foreign_key(
        "fk_contacts_account_id",
        "contacts",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_contacts_account_id", "contacts", ["account_id"])

    # 4. Make account_id NOT NULL now that all rows are populated
    op.alter_column("contacts", "account_id", nullable=False)

    # 5. Make assignment_id nullable (contacts can exist without an assignment)
    op.alter_column("contacts", "assignment_id", nullable=True)

    # 6. Change assignment FK to SET NULL on delete (not CASCADE)
    op.drop_constraint("contacts_assignment_id_fkey", "contacts", type_="foreignkey")
    op.create_foreign_key(
        "fk_contacts_assignment_id",
        "contacts",
        "assignments",
        ["assignment_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 7. Drop the unique constraint on assignment_id (account can have multiple contacts)
    op.drop_constraint("uq_contacts_assignment_id", "contacts", type_="unique")


def downgrade() -> None:
    # Restore unique constraint
    op.create_unique_constraint("uq_contacts_assignment_id", "contacts", ["assignment_id"])

    # Restore assignment FK as CASCADE
    op.drop_constraint("fk_contacts_assignment_id", "contacts", type_="foreignkey")
    op.create_foreign_key(
        "contacts_assignment_id_fkey",
        "contacts",
        "assignments",
        ["assignment_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Restore assignment_id as NOT NULL
    op.alter_column("contacts", "assignment_id", nullable=False)

    # Remove account_id
    op.drop_index("ix_contacts_account_id", table_name="contacts")
    op.drop_constraint("fk_contacts_account_id", "contacts", type_="foreignkey")
    op.drop_column("contacts", "account_id")
