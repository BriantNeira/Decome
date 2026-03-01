import pyotp

from app.config import settings


def generate_totp_secret() -> str:
    """Generate a new base32 TOTP secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """Return an otpauth:// URI suitable for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=settings.app_name)


def verify_totp(secret: str, code: str) -> bool:
    """Verify a 6-digit TOTP code. Allows 1 period of drift (30 s)."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
