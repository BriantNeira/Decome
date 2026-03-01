import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, User


@pytest.mark.asyncio
async def test_list_accounts_admin(client: AsyncClient, admin_token: str):
    """Admin can list all accounts"""
    res = await client.get("/api/accounts", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_accounts_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot list accounts"""
    res = await client.get("/api/accounts", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_account_admin(client: AsyncClient, admin_token: str):
    """Admin can create an account"""
    payload = {
        "name": "Test Account",
        "code": "TEST001",
        "description": "A test account",
    }
    res = await client.post("/api/accounts", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Account"
    assert data["code"] == "TEST001"
    assert data["description"] == "A test account"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_account_duplicate_code(client: AsyncClient, admin_token: str):
    """Cannot create account with duplicate code"""
    payload = {"name": "Account 1", "code": "DUP001", "description": "First"}
    res1 = await client.post("/api/accounts", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res1.status_code == 201

    payload2 = {"name": "Account 2", "code": "DUP001", "description": "Second"}
    res2 = await client.post("/api/accounts", json=payload2, headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 400


@pytest.mark.asyncio
async def test_create_account_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot create account"""
    payload = {"name": "Test", "code": "TEST", "description": "Test"}
    res = await client.post("/api/accounts", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_account(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get a single account"""
    # Create an account
    account = Account(name="Get Test", code="GET001", description="Test get")
    db.add(account)
    await db.commit()
    await db.refresh(account)

    res = await client.get(f"/api/accounts/{account.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(account.id)
    assert data["name"] == "Get Test"


@pytest.mark.asyncio
async def test_update_account(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update an account"""
    account = Account(name="Original", code="UPD001", description="Test")
    db.add(account)
    await db.commit()
    await db.refresh(account)

    payload = {"name": "Updated Name", "description": "Updated description"}
    res = await client.patch(f"/api/accounts/{account.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_delete_account(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete an account"""
    account = Account(name="Delete Test", code="DEL001", description="Test")
    db.add(account)
    await db.commit()
    await db.refresh(account)

    res = await client.delete(f"/api/accounts/{account.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/accounts/{account.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_account_audit_log_on_create(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Creating an account should generate audit log"""
    from app.models.audit_log import AuditLog
    from sqlalchemy import select

    payload = {"name": "Audit Test Unique", "code": "AUDIT001UNIQUE", "description": "Test audit"}
    res = await client.post("/api/accounts", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    account_id = res.json()["id"]

    # Check audit log exists for this specific account
    result = await db.execute(
        select(AuditLog).where(
            (AuditLog.action == "ACCOUNT_CREATED") & (AuditLog.resource_id == account_id)
        )
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.action == "ACCOUNT_CREATED"
    assert "Audit Test Unique" in str(audit.details)
