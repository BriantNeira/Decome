import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.branding import BrandingConfig

ALLOWED_LOGO_TYPES = {"image/svg+xml", "image/png"}
ALLOWED_LOGO_EXTS = {".svg", ".png"}
ALLOWED_FAVICON_TYPES = {"image/png", "image/x-icon", "image/vnd.microsoft.icon"}
ALLOWED_FAVICON_EXTS = {".png", ".ico"}


async def get_or_create_config(db: AsyncSession) -> BrandingConfig:
    result = await db.execute(select(BrandingConfig).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = BrandingConfig()
        db.add(config)
        await db.flush()
    return config


def _asset_url(filename: str | None) -> str | None:
    if not filename:
        return None
    return f"/api/branding/assets/{filename}"


async def get_branding(db: AsyncSession) -> dict:
    config = await get_or_create_config(db)
    return {
        "logo_light_url": _asset_url(config.logo_light_path),
        "logo_dark_url": _asset_url(config.logo_dark_path),
        "favicon_url": _asset_url(config.favicon_path),
    }


def _upload_dir() -> Path:
    path = Path(settings.upload_dir) / "branding"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def upload_logo(
    db: AsyncSession,
    file: UploadFile,
    variant: str,
    user_id: uuid.UUID,
) -> dict:
    """variant: 'light' | 'dark'"""
    if variant not in ("light", "dark"):
        raise HTTPException(status_code=400, detail="variant must be 'light' or 'dark'")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_LOGO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo must be SVG or PNG. Got: {ext}",
        )

    content = await file.read()
    if len(content) > settings.max_logo_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo exceeds max size of {settings.max_logo_size_bytes // 1024 // 1024} MB.",
        )

    filename = f"logo_{variant}_{uuid.uuid4().hex}{ext}"
    dest = _upload_dir() / filename

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    config = await get_or_create_config(db)
    old_path = config.logo_light_path if variant == "light" else config.logo_dark_path
    _delete_old_file(old_path)

    if variant == "light":
        config.logo_light_path = filename
    else:
        config.logo_dark_path = filename
    config.updated_by = user_id

    return {"filename": filename, "url": _asset_url(filename)}


async def upload_favicon(
    db: AsyncSession,
    file: UploadFile,
    user_id: uuid.UUID,
) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_FAVICON_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Favicon must be PNG or ICO. Got: {ext}",
        )

    content = await file.read()
    if len(content) > settings.max_favicon_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Favicon exceeds max size of {settings.max_favicon_size_bytes // 1024} KB.",
        )

    filename = f"favicon_{uuid.uuid4().hex}{ext}"
    dest = _upload_dir() / filename

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    config = await get_or_create_config(db)
    _delete_old_file(config.favicon_path)
    config.favicon_path = filename
    config.updated_by = user_id

    return {"filename": filename, "url": _asset_url(filename)}


async def delete_logo(db: AsyncSession, variant: str, user_id: uuid.UUID) -> None:
    config = await get_or_create_config(db)
    if variant == "light":
        _delete_old_file(config.logo_light_path)
        config.logo_light_path = None
    else:
        _delete_old_file(config.logo_dark_path)
        config.logo_dark_path = None
    config.updated_by = user_id


async def delete_favicon(db: AsyncSession, user_id: uuid.UUID) -> None:
    config = await get_or_create_config(db)
    _delete_old_file(config.favicon_path)
    config.favicon_path = None
    config.updated_by = user_id


def _delete_old_file(filename: str | None) -> None:
    if not filename:
        return
    path = _upload_dir() / filename
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


async def get_asset_path(filename: str) -> Path:
    path = _upload_dir() / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found.")
    return path
