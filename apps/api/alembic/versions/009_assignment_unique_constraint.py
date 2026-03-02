"""tighten assignment unique constraint: one BDM per account

Revision ID: 009
Revises: 008
Create Date: 2026-03-02

"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Remove duplicate (user_id, account_id) rows, keeping the
    # most-recently-created assignment for each pair.
    op.execute("""
        DELETE FROM assignments
        WHERE id NOT IN (
            SELECT DISTINCT ON (user_id, account_id) id
            FROM assignments
            ORDER BY user_id, account_id, created_at DESC
        )
    """)

    # Step 2: Drop the old 3-column unique constraint
    op.drop_constraint(
        "uq_assignment_user_account_program", "assignments", type_="unique"
    )

    # Step 3: Add the new 2-column unique constraint
    op.create_unique_constraint(
        "uq_assignment_user_account",
        "assignments",
        ["user_id", "account_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_assignment_user_account", "assignments", type_="unique")
    op.create_unique_constraint(
        "uq_assignment_user_account_program",
        "assignments",
        ["user_id", "account_id", "program_id"],
    )
