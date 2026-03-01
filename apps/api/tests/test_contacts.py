import uuid as uuid_lib
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Account, Program, Assignment, Contact, User
from app.utils.security import hash_password


async def _make_account(db: AsyncSession) -> Account:
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10].upper()
    account = Account(name=f"Contact Test Account {uid}", code=uid, description="Test")
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def _make_program(db: AsyncSession) -> Program:
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10]
    program = Program(name=f"Contact Test Program {uid}", description="Test", is_active=True)
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


async def _make_assignment(db: AsyncSession, user_id, account_id, program_id) -> Assignment:
    assignment = Assignment(user_id=user_id, account_id=account_id, program_id=program_id, is_active=True)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


# ── Admin tests ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_contacts_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can list all contacts"""
    account = await _make_account(db)
    contact = Contact(account_id=account.id, first_name="List", last_name="Test", email="list@test.com")
    db.add(contact)
    await db.commit()

    res = await client.get("/api/contacts", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0


@pytest.mark.asyncio
async def test_create_contact_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can create a contact with all fields + program_ids"""
    account = await _make_account(db)
    program = await _make_program(db)

    payload = {
        "account_id": str(account.id),
        "title": "Mr",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com",
        "phone": "+1 555 123 4567",
        "is_decision_maker": True,
        "program_ids": [str(program.id)],
    }
    res = await client.post("/api/contacts", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Mr"
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["email"] == "john.doe@example.com"
    assert data["phone"] == "+1 555 123 4567"
    assert data["is_decision_maker"] is True
    assert data["account_id"] == str(account.id)
    assert str(program.id) in data["program_ids"]
    assert len(data["program_names"]) == 1


@pytest.mark.asyncio
async def test_get_contact_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get a single contact"""
    account = await _make_account(db)
    contact = Contact(account_id=account.id, first_name="Get", last_name="Test")
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    res = await client.get(f"/api/contacts/{contact.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(contact.id)
    assert data["first_name"] == "Get"


@pytest.mark.asyncio
async def test_update_contact_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update contact fields + program_ids"""
    account = await _make_account(db)
    program = await _make_program(db)

    # Create via API
    create_payload = {
        "account_id": str(account.id),
        "first_name": "Before",
        "last_name": "Update",
    }
    create_res = await client.post("/api/contacts", json=create_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    contact_id = create_res.json()["id"]

    # Update
    update_payload = {
        "first_name": "After",
        "is_decision_maker": True,
        "program_ids": [str(program.id)],
    }
    res = await client.patch(f"/api/contacts/{contact_id}", json=update_payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["first_name"] == "After"
    assert data["is_decision_maker"] is True
    assert str(program.id) in data["program_ids"]


@pytest.mark.asyncio
async def test_delete_contact_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete a contact"""
    account = await _make_account(db)
    contact = Contact(account_id=account.id, first_name="Delete", last_name="Me")
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    res = await client.delete(f"/api/contacts/{contact.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/contacts/{contact.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404


# ── BDM tests ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_contact_bdm(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM can create a contact for an account they are assigned to"""
    account = await _make_account(db)
    program = await _make_program(db)
    await _make_assignment(db, bdm_user.id, account.id, program.id)

    payload = {
        "account_id": str(account.id),
        "first_name": "BDM",
        "last_name": "Contact",
        "email": "bdm.contact@example.com",
    }
    res = await client.post("/api/contacts", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["first_name"] == "BDM"
    assert data["account_id"] == str(account.id)


@pytest.mark.asyncio
async def test_create_contact_bdm_unassigned(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM cannot create a contact for an account they are NOT assigned to"""
    account = await _make_account(db)
    # No assignment created for this BDM

    payload = {
        "account_id": str(account.id),
        "first_name": "Forbidden",
        "last_name": "Contact",
    }
    res = await client.post("/api/contacts", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_update_contact_bdm(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM can update a contact for an assigned account"""
    account = await _make_account(db)
    program = await _make_program(db)
    await _make_assignment(db, bdm_user.id, account.id, program.id)

    # Create contact directly in DB
    contact = Contact(account_id=account.id, first_name="Old", last_name="Name")
    db.add(contact)
    await db.commit()
    await db.refresh(contact)

    payload = {"first_name": "New"}
    res = await client.patch(f"/api/contacts/{contact.id}", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    assert res.json()["first_name"] == "New"


@pytest.mark.asyncio
async def test_list_contacts_bdm_filtered(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM only sees contacts for accounts they are assigned to"""
    # Account 1: BDM is assigned
    account1 = await _make_account(db)
    program = await _make_program(db)
    await _make_assignment(db, bdm_user.id, account1.id, program.id)

    c1 = Contact(account_id=account1.id, first_name="Visible", last_name="Contact")
    db.add(c1)

    # Account 2: BDM is NOT assigned
    account2 = await _make_account(db)
    c2 = Contact(account_id=account2.id, first_name="Hidden", last_name="Contact")
    db.add(c2)

    await db.commit()

    res = await client.get("/api/contacts", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    data = res.json()
    # All returned contacts should belong to accounts the BDM is assigned to
    contact_names = [item["first_name"] for item in data["items"]]
    assert "Visible" in contact_names
    assert "Hidden" not in contact_names


@pytest.mark.asyncio
async def test_contact_program_association(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Contact N:M with programs works correctly"""
    account = await _make_account(db)
    prog1 = await _make_program(db)
    prog2 = await _make_program(db)

    # Create with two programs
    payload = {
        "account_id": str(account.id),
        "first_name": "Multi",
        "last_name": "Program",
        "program_ids": [str(prog1.id), str(prog2.id)],
    }
    create_res = await client.post("/api/contacts", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert create_res.status_code == 201
    data = create_res.json()
    assert len(data["program_ids"]) == 2
    assert str(prog1.id) in data["program_ids"]
    assert str(prog2.id) in data["program_ids"]

    # Update to remove one program
    contact_id = data["id"]
    update_res = await client.patch(
        f"/api/contacts/{contact_id}",
        json={"program_ids": [str(prog1.id)]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert update_res.status_code == 200
    assert len(update_res.json()["program_ids"]) == 1
    assert str(prog1.id) in update_res.json()["program_ids"]
