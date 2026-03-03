import base64
import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PASSWORD_POLICY = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$"
)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def validate_password_policy(password: str) -> bool:
    """Returns True if password meets complexity requirements."""
    return bool(PASSWORD_POLICY.match(password))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.jwt_expiry_minutes)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises JWTError on invalid/expired tokens."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


def create_temp_token(user_id: str) -> str:
    """Short-lived token for 2FA second step."""
    return create_access_token(
        {"sub": user_id, "purpose": "2fa_verify"},
        expires_delta=timedelta(minutes=settings.jwt_2fa_temp_expiry_minutes),
    )


def create_reset_token() -> str:
    """Generate a secure random reset token (URL-safe)."""
    return secrets.token_urlsafe(32)


# ── TOTP secret encryption ────────────────────────────────────────────────────

def _get_fernet() -> Fernet:
    """Derive a Fernet key from SECRET_KEY using SHA-256."""
    key_bytes = hashlib.sha256(settings.secret_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)


def encrypt_totp_secret(secret: str) -> str:
    return _get_fernet().encrypt(secret.encode()).decode()


def decrypt_totp_secret(encrypted: str) -> str:
    return _get_fernet().decrypt(encrypted.encode()).decode()


# ── Generic field encryption ─────────────────────────────────────────────────

def encrypt_field(value: str) -> str:
    """Encrypt any sensitive string field (API keys, passwords, secrets)."""
    if not value:
        return value
    return _get_fernet().encrypt(value.encode()).decode()


def decrypt_field(encrypted: str) -> str:
    """Decrypt any sensitive string field."""
    if not encrypted:
        return encrypted
    return _get_fernet().decrypt(encrypted.encode()).decode()


def is_encrypted(value: str) -> bool:
    """Check whether a value is already Fernet-encrypted."""
    if not value:
        return False
    try:
        _get_fernet().decrypt(value.encode())
        return True
    except Exception:
        return False
