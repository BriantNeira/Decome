import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.role import Role
from app.models.user import User
from app.utils.security import (
    create_access_token,
    create_reset_token,
    create_temp_token,
    decode_access_token,
    decrypt_totp_secret,
    encrypt_totp_secret,
    hash_password,
    verify_password,
)
from app.utils.totp import generate_totp_secret, get_totp_uri, verify_totp


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.name == name))
    return result.scalar_one_or_none()


async def login(db: AsyncSession, email: str, password: str) -> dict:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled.",
        )

    if user.totp_enabled:
        temp_token = create_temp_token(str(user.id))
        return {"requires_2fa": True, "temp_token": temp_token}

    access_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role.name}
    )
    return {"requires_2fa": False, "access_token": access_token}


async def verify_2fa(db: AsyncSession, temp_token: str, code: str) -> str:
    try:
        payload = decode_access_token(temp_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    if payload.get("purpose") != "2fa_verify":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token purpose.",
        )

    user_id = uuid.UUID(payload["sub"])
    user = await get_user_by_id(db, user_id)
    if not user or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA not configured.",
        )

    secret = decrypt_totp_secret(user.totp_secret)
    if not verify_totp(secret, code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code.",
        )

    access_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role.name}
    )
    return access_token


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    role_name: str,
) -> User:
    existing = await get_user_by_email(db, email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered.",
        )

    role = await get_role_by_name(db, role_name)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{role_name}' not found.",
        )

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role_id=role.id,
    )
    db.add(user)
    await db.flush()
    return user


async def request_password_reset(db: AsyncSession, email: str) -> str | None:
    """Returns the plain reset token (for logging in dev). None if user not found."""
    user = await get_user_by_email(db, email)
    if not user:
        return None

    token = create_reset_token()
    user.password_reset_token = hashlib.sha256(token.encode()).hexdigest()
    user.password_reset_expires = datetime.now(UTC) + timedelta(
        minutes=settings.jwt_reset_expiry_minutes
    )
    return token


async def confirm_password_reset(db: AsyncSession, token: str, new_password: str) -> None:
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(User).where(User.password_reset_token == token_hash)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token.",
        )

    now = datetime.now(UTC)
    expires = user.password_reset_expires
    if expires is None or (expires.tzinfo is None and now.replace(tzinfo=None) > expires) or (expires.tzinfo is not None and now > expires):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired.",
        )

    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None


async def setup_2fa(db: AsyncSession, user: User) -> dict:
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user.email)
    # Store encrypted secret temporarily (user must confirm with a code)
    user.totp_secret = encrypt_totp_secret(secret)
    return {"secret": secret, "uri": uri}


async def enable_2fa(db: AsyncSession, user: User, code: str) -> None:
    if not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA setup not initiated. Call /api/auth/2fa/setup first.",
        )
    secret = decrypt_totp_secret(user.totp_secret)
    if not verify_totp(secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )
    user.totp_enabled = True


async def disable_2fa(db: AsyncSession, user: User, code: str) -> None:
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled.",
        )
    secret = decrypt_totp_secret(user.totp_secret)
    if not verify_totp(secret, code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code.",
        )
    user.totp_enabled = False
    user.totp_secret = None
