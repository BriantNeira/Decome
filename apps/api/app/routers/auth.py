import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    TwoFADisableRequest,
    TwoFAEnableRequest,
    TwoFASetupResponse,
    TwoFAVerifyRequest,
    UserRead,
)
from app.services import audit_service, auth_service
from app.middleware.rbac import require_roles

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    ua = request.headers.get("User-Agent")
    return ip, ua


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip, ua = _client_info(request)
    try:
        result = await auth_service.login(db, body.email, body.password)
        user = await auth_service.get_user_by_email(db, body.email)
        await audit_service.log_action(
            db,
            action="LOGIN_SUCCESS",
            user_id=user.id if user else None,
            details={"email": body.email},
            ip_address=ip,
            user_agent=ua,
        )
        return LoginResponse(**result)
    except Exception:
        await audit_service.log_action(
            db,
            action="LOGIN_FAILED",
            details={"email": body.email},
            ip_address=ip,
            user_agent=ua,
        )
        raise


@router.post("/login/2fa", response_model=LoginResponse)
async def verify_2fa(
    body: TwoFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip, ua = _client_info(request)
    access_token = await auth_service.verify_2fa(db, body.temp_token, body.code)
    await audit_service.log_action(
        db,
        action="LOGIN_2FA_SUCCESS",
        ip_address=ip,
        user_agent=ua,
    )
    return LoginResponse(access_token=access_token, requires_2fa=False)


@router.post("/register", response_model=UserRead, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    user = await auth_service.register_user(
        db, body.email, body.password, body.full_name, body.role
    )
    await audit_service.log_action(
        db,
        action="USER_CREATED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(user.id),
        details={"email": user.email, "role": body.role},
        ip_address=ip,
        user_agent=ua,
    )
    return UserRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=body.role,
        is_active=user.is_active,
        totp_enabled=user.totp_enabled,
    )


@router.post("/password-reset/request")
async def password_reset_request(
    body: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip, ua = _client_info(request)
    token = await auth_service.request_password_reset(db, body.email)
    if token:
        logger.info(
            "Password reset token for %s: %s (DEV ONLY — use this to reset)",
            body.email,
            token,
        )
    await audit_service.log_action(
        db,
        action="PASSWORD_RESET_REQUESTED",
        details={"email": body.email},
        ip_address=ip,
        user_agent=ua,
    )
    # Always return success (don't reveal if email exists)
    return {"message": "If the email exists, a reset link has been sent."}


@router.post("/password-reset/confirm")
async def password_reset_confirm(
    body: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip, ua = _client_info(request)
    await auth_service.confirm_password_reset(db, body.token, body.new_password)
    await audit_service.log_action(
        db,
        action="PASSWORD_RESET_COMPLETED",
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": "Password updated successfully."}


@router.post("/2fa/setup", response_model=TwoFASetupResponse)
async def setup_2fa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await auth_service.setup_2fa(db, current_user)
    return TwoFASetupResponse(**result)


@router.post("/2fa/enable")
async def enable_2fa(
    body: TwoFAEnableRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip, ua = _client_info(request)
    await auth_service.enable_2fa(db, current_user, body.code)
    await audit_service.log_action(
        db,
        action="TOTP_ENABLED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(current_user.id),
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": "2FA enabled successfully."}


@router.post("/2fa/disable")
async def disable_2fa(
    body: TwoFADisableRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip, ua = _client_info(request)
    await auth_service.disable_2fa(db, current_user, body.code)
    await audit_service.log_action(
        db,
        action="TOTP_DISABLED",
        user_id=current_user.id,
        resource_type="user",
        resource_id=str(current_user.id),
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": "2FA disabled successfully."}


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.name,
        is_active=current_user.is_active,
        totp_enabled=current_user.totp_enabled,
    )


@router.post("/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip, ua = _client_info(request)
    await audit_service.log_action(
        db,
        action="LOGOUT",
        user_id=current_user.id,
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": "Logged out successfully."}
