import uuid
from pydantic import BaseModel, field_validator

from app.utils.security import validate_password_policy
from app.utils.validators import LocalEmail


class LoginRequest(BaseModel):
    email: LocalEmail
    password: str


class LoginResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    temp_token: str | None = None


class TwoFAVerifyRequest(BaseModel):
    temp_token: str
    code: str


class RegisterRequest(BaseModel):
    email: LocalEmail
    password: str
    full_name: str
    role: str  # "admin" | "bdm" | "director"

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


class PasswordResetRequest(BaseModel):
    email: LocalEmail


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not validate_password_policy(v):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, "
                "lowercase, digit, and special character."
            )
        return v


class TwoFASetupResponse(BaseModel):
    secret: str
    uri: str


class TwoFAEnableRequest(BaseModel):
    code: str


class TwoFADisableRequest(BaseModel):
    code: str


class UserRead(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    totp_enabled: bool

    model_config = {"from_attributes": True}
