"""Encrypt existing plaintext sensitive fields (smtp_password, api_key).

Revision ID: 016
Revises: 015
Create Date: 2026-03-02
"""
import base64
import hashlib
import os

from alembic import op
import sqlalchemy as sa
from cryptography.fernet import Fernet

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def _get_fernet() -> Fernet:
    secret_key = os.environ.get("SECRET_KEY", "change-me-in-production")
    key_bytes = hashlib.sha256(secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def _is_encrypted(value: str) -> bool:
    try:
        _get_fernet().decrypt(value.encode())
        return True
    except Exception:
        return False


def upgrade() -> None:
    """Encrypt plaintext smtp_password and api_key in-place."""
    conn = op.get_bind()
    fernet = _get_fernet()

    # Encrypt email_config.smtp_password
    rows = conn.execute(
        sa.text("SELECT id, smtp_password FROM email_config WHERE smtp_password IS NOT NULL")
    ).fetchall()
    for row in rows:
        val = row[1]
        if val and not _is_encrypted(val):
            encrypted = fernet.encrypt(val.encode()).decode()
            conn.execute(
                sa.text("UPDATE email_config SET smtp_password = :pwd WHERE id = :id"),
                {"pwd": encrypted, "id": row[0]},
            )

    # Encrypt llm_config.api_key
    rows = conn.execute(
        sa.text("SELECT id, api_key FROM llm_config WHERE api_key IS NOT NULL")
    ).fetchall()
    for row in rows:
        val = row[1]
        if val and not _is_encrypted(val):
            encrypted = fernet.encrypt(val.encode()).decode()
            conn.execute(
                sa.text("UPDATE llm_config SET api_key = :key WHERE id = :id"),
                {"key": encrypted, "id": row[0]},
            )


def downgrade() -> None:
    """Decrypt back to plaintext (best-effort)."""
    conn = op.get_bind()
    fernet = _get_fernet()

    rows = conn.execute(
        sa.text("SELECT id, smtp_password FROM email_config WHERE smtp_password IS NOT NULL")
    ).fetchall()
    for row in rows:
        val = row[1]
        if val and _is_encrypted(val):
            decrypted = fernet.decrypt(val.encode()).decode()
            conn.execute(
                sa.text("UPDATE email_config SET smtp_password = :pwd WHERE id = :id"),
                {"pwd": decrypted, "id": row[0]},
            )

    rows = conn.execute(
        sa.text("SELECT id, api_key FROM llm_config WHERE api_key IS NOT NULL")
    ).fetchall()
    for row in rows:
        val = row[1]
        if val and _is_encrypted(val):
            decrypted = fernet.decrypt(val.encode()).decode()
            conn.execute(
                sa.text("UPDATE llm_config SET api_key = :key WHERE id = :id"),
                {"key": decrypted, "id": row[0]},
            )
