"""Change assignment unique constraint to (program_id, account_id)

Revision ID: 010
Revises: 009
Create Date: 2026-03-02

"""
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Remove duplicate (program_id, account_id) rows, keeping the
    # most-recently-created assignment for each pair.
    op.execute("""
        DELETE FROM assignments
        WHERE id NOT IN (
            SELECT DISTINCT ON (program_id, account_id) id
            FROM assignments
            ORDER BY program_id, account_id, created_at DESC
        )
    """)

    # Step 2: Drop the old 2-column unique constraint
    op.drop_constraint(
        "uq_assignment_user_account", "assignments", type_="unique"
    )

    # Step 3: Add the new 2-column unique constraint (program + account)
    op.create_unique_constraint(
        "uq_assignment_program_account",
        "assignments",
        ["program_id", "account_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_assignment_program_account", "assignments", type_="unique")
    op.create_unique_constraint(
        "uq_assignment_user_account",
        "assignments",
        ["user_id", "account_id"],
    )
