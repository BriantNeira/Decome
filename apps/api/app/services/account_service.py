import uuid
from pathlib import Path

import aiofiles
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, UploadFile, status

from app.config import settings
from app.models.account import Account
from app.models.assignment import Assignment

ALLOWED_LOGO_EXTS = {".svg", ".png"}


def _account_upload_dir() -> Path:
    path = Path(settings.upload_dir) / "accounts"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _logo_url(filename: str | None) -> str | None:
    if not filename:
        return None
    return f"/api/accounts/assets/{filename}"


async def list_accounts(
    db: AsyncSession, skip: int = 0, limit: int = 50, search: str | None = None
) -> tuple[list[Account], int]:
    query = select(Account)
    if search:
        query = query.where(Account.name.ilike(f"%{search}%"))

    count_result = await db.execute(select(func.count()).select_from(Account))
    total = count_result.scalar() or 0

    result = await db.execute(query.offset(skip).limit(limit))
    accounts = result.scalars().all()
    return accounts, total


async def get_account(db: AsyncSession, account_id: str) -> Account:
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


async def get_account_detail(db: AsyncSession, account_id: str) -> Account:
    """Get account with all related assignments, contacts, and notes."""
    from app.models.account_note import AccountNote

    result = await db.execute(
        select(Account)
        .options(
            selectinload(Account.assignments).selectinload(Assignment.program),
            selectinload(Account.assignments).selectinload(Assignment.user),
            selectinload(Account.contacts),
            selectinload(Account.notes).selectinload(AccountNote.author),
        )
        .where(Account.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


async def create_account(
    db: AsyncSession, name: str, code: str | None = None, description: str | None = None
) -> Account:
    if code:
        existing = await db.execute(select(Account).where(Account.code == code))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Code already exists"
            )

    account = Account(name=name, code=code, description=description)
    db.add(account)
    await db.flush()
    return account


async def update_account(db: AsyncSession, account_id: str, **fields) -> Account:
    account = await get_account(db, account_id)

    if "code" in fields and fields["code"]:
        existing = await db.execute(
            select(Account).where(
                Account.code == fields["code"], Account.id != account_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Code already exists"
            )

    for key, value in fields.items():
        if hasattr(account, key) and value is not None:
            setattr(account, key, value)

    await db.flush()
    return account


async def delete_account(db: AsyncSession, account_id: str) -> Account:
    account = await get_account(db, account_id)

    # Check if there are active assignments
    result = await db.execute(
        select(Assignment).where(
            Assignment.account_id == account_id, Assignment.is_active == True
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete account with active assignments",
        )

    await db.delete(account)
    await db.flush()
    return account


async def upload_logo(
    db: AsyncSession,
    account_id: uuid.UUID,
    file: UploadFile,
) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_LOGO_EXTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo must be SVG or PNG. Got: {ext}",
        )

    content = await file.read()
    max_bytes = getattr(settings, "max_logo_size_bytes", 2 * 1024 * 1024)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Logo exceeds max size of {max_bytes // 1024 // 1024} MB.",
        )

    filename = f"account_{account_id.hex}_{uuid.uuid4().hex}{ext}"
    dest = _account_upload_dir() / filename

    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    account = await get_account(db, account_id)
    # Delete old file if present
    if account.logo_url:
        old_filename = account.logo_url.split("/")[-1]
        old_path = _account_upload_dir() / old_filename
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass

    account.logo_url = _logo_url(filename)
    await db.flush()
    return {"filename": filename, "url": account.logo_url}


async def delete_logo(db: AsyncSession, account_id: uuid.UUID) -> None:
    account = await get_account(db, account_id)
    if account.logo_url:
        old_filename = account.logo_url.split("/")[-1]
        old_path = _account_upload_dir() / old_filename
        try:
            old_path.unlink(missing_ok=True)
        except OSError:
            pass
    account.logo_url = None
    await db.flush()


async def get_asset_path(filename: str) -> Path:
    path = _account_upload_dir() / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found.")
    return path
