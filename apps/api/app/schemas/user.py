import uuid
from pydantic import BaseModel, field_validator

from app.utils.security import validate_password_policy
from app.utils.validators import LocalEmail


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    totp_enabled: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str | None) -> str | None:
        if v is not None and v not in ("admin", "bdm", "director"):
            raise ValueError("Role must be admin, bdm, or director.")
        return v


class UserCreate(BaseModel):
    email: LocalEmail
    password: str
    full_name: str
    role: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not validate_password_policy(v):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, digit, and special character."
            )
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("admin", "bdm", "director"):
            raise ValueError("Role must be admin, bdm, or director.")
        return v


class UserSelfUpdate(BaseModel):
    """Schema for a user updating their own profile (name only — no role/status change)."""
    full_name: str | None = None


class UserListResponse(BaseModel):
    items: list[UserRead]
    total: int
