from fastapi import APIRouter, Depends, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.middleware.rbac import require_roles
from app.models.user import User
from app.schemas.branding import BrandingConfigRead
from app.services import audit_service, branding_service

router = APIRouter(prefix="/api/branding", tags=["branding"])


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else None)
    ua = request.headers.get("User-Agent")
    return ip, ua


@router.get("", response_model=BrandingConfigRead)
async def get_branding(db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required (needed for login page)."""
    return await branding_service.get_branding(db)


@router.post("/logo")
async def upload_logo(
    file: UploadFile,
    request: Request,
    variant: str = Query(default="light", pattern="^(light|dark)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    result = await branding_service.upload_logo(db, file, variant, current_user.id)
    await audit_service.log_action(
        db,
        action="BRANDING_LOGO_UPLOADED",
        user_id=current_user.id,
        resource_type="branding",
        details={"variant": variant, "filename": result["filename"]},
        ip_address=ip,
        user_agent=ua,
    )
    return result


@router.post("/favicon")
async def upload_favicon(
    file: UploadFile,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    result = await branding_service.upload_favicon(db, file, current_user.id)
    await audit_service.log_action(
        db,
        action="BRANDING_FAVICON_UPLOADED",
        user_id=current_user.id,
        resource_type="branding",
        details={"filename": result["filename"]},
        ip_address=ip,
        user_agent=ua,
    )
    return result


@router.delete("/logo")
async def delete_logo(
    request: Request,
    variant: str = Query(default="light", pattern="^(light|dark)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    await branding_service.delete_logo(db, variant, current_user.id)
    await audit_service.log_action(
        db,
        action="BRANDING_LOGO_DELETED",
        user_id=current_user.id,
        resource_type="branding",
        details={"variant": variant},
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": f"{variant} logo deleted."}


@router.delete("/favicon")
async def delete_favicon(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    ip, ua = _client_info(request)
    await branding_service.delete_favicon(db, current_user.id)
    await audit_service.log_action(
        db,
        action="BRANDING_FAVICON_DELETED",
        user_id=current_user.id,
        resource_type="branding",
        ip_address=ip,
        user_agent=ua,
    )
    return {"message": "Favicon deleted."}


@router.get("/assets/{filename}")
async def serve_asset(filename: str):
    """Serve uploaded branding assets (public)."""
    path = await branding_service.get_asset_path(filename)
    return FileResponse(path)
