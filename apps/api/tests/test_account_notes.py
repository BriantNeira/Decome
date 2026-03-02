import uuid as uuid_lib
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, AccountNote


async def _create_account(db: AsyncSession, name: str | None = None, code: str | None = None) -> Account:
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10].upper()
    account = Account(
        name=name or f"Note Test Account {uid}",
        code=code or uid,
        description="Test",
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@pytest.mark.asyncio
async def test_list_notes_empty(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can list notes for an account (empty)"""
    account = await _create_account(db, "Notes Empty", "NE001")
    res = await client.get(
        f"/api/accounts/{account.id}/notes",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_create_note_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can create a note"""
    account = await _create_account(db, "Note Create Admin", "NCA001")
    res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "Admin note content"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["content"] == "Admin note content"
    assert "id" in data
    assert "author_name" in data


@pytest.mark.asyncio
async def test_create_note_bdm(client: AsyncClient, bdm_token: str, db: AsyncSession):
    """BDM can create a note"""
    account = await _create_account(db, "Note Create BDM", "NCB001")
    res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "BDM note content"},
        headers={"Authorization": f"Bearer {bdm_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["content"] == "BDM note content"


@pytest.mark.asyncio
async def test_create_note_empty_content(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Cannot create note with empty content"""
    account = await _create_account(db, "Note Empty Content", "NEC001")
    res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": ""},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_update_note_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update any note"""
    account = await _create_account(db, "Note Update Admin", "NUA001")
    # Create note
    create_res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "Original content"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    note_id = create_res.json()["id"]

    # Update
    update_res = await client.patch(
        f"/api/accounts/{account.id}/notes/{note_id}",
        json={"content": "Updated content"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["content"] == "Updated content"


@pytest.mark.asyncio
async def test_delete_note_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete any note"""
    account = await _create_account(db, "Note Delete Admin", "NDA001")
    create_res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "To be deleted"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    note_id = create_res.json()["id"]

    delete_res = await client.delete(
        f"/api/accounts/{account.id}/notes/{note_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert delete_res.status_code == 200

    # Verify gone
    list_res = await client.get(
        f"/api/accounts/{account.id}/notes",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert list_res.json()["total"] == 0


@pytest.mark.asyncio
async def test_account_detail_includes_notes(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Account detail endpoint includes notes"""
    account = await _create_account(db, "Detail With Notes", "DWN001")
    # Add a note
    await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "Detail note"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Fetch detail
    detail_res = await client.get(
        f"/api/accounts/{account.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert "notes" in detail
    assert len(detail["notes"]) == 1
    assert detail["notes"][0]["content"] == "Detail note"


@pytest.mark.asyncio
async def test_note_audit_log_on_create(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Creating a note should generate audit log"""
    from app.models.audit_log import AuditLog
    from sqlalchemy import select

    account = await _create_account(db, "Note Audit", "NAUD001")
    res = await client.post(
        f"/api/accounts/{account.id}/notes",
        json={"content": "Audit test note"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    note_id = res.json()["id"]

    result = await db.execute(
        select(AuditLog).where(
            (AuditLog.action == "NOTE_CREATED") & (AuditLog.resource_id == str(note_id))
        )
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.action == "NOTE_CREATED"
