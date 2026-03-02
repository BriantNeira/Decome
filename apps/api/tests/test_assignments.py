import uuid as uuid_lib
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Program, Assignment, User


async def create_test_account(db: AsyncSession) -> Account:
    """Helper to create a test account with a unique code to avoid conflicts."""
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10].upper()
    account = Account(name=f"Test Account {uid}", code=uid, description="Test")
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def create_test_program(db: AsyncSession) -> Program:
    """Helper to create a test program with a unique name to avoid conflicts."""
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10]
    program = Program(name=f"Test Program {uid}", description="Test")
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


@pytest.mark.asyncio
async def test_list_assignments_admin(client: AsyncClient, admin_token: str):
    """Admin can list all assignments"""
    res = await client.get("/api/assignments", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_assignments_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot list all assignments (only their own)"""
    res = await client.get("/api/assignments", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_assignment_admin(client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession):
    """Admin can create an assignment for a BDM"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    payload = {
        "user_id": str(bdm_user.id),
        "account_id": str(account.id),
        "program_id": str(program.id),
    }
    res = await client.post("/api/assignments", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["user_id"] == str(bdm_user.id)
    assert data["account_id"] == str(account.id)
    assert data["program_id"] == str(program.id)
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_assignment_bdm_forbidden(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM cannot create assignments"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    payload = {
        "user_id": str(bdm_user.id),
        "account_id": str(account.id),
        "program_id": str(program.id),
    }
    res = await client.post("/api/assignments", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_my_assignments_bdm(client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession):
    """BDM can list their own assignments"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    # Create an assignment for the BDM
    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    res = await client.get("/api/assignments/my", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) > 0
    assert data["items"][0]["user_id"] == str(bdm_user.id)


@pytest.mark.asyncio
async def test_get_assignment(client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession):
    """Admin can get a single assignment"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    res = await client.get(f"/api/assignments/{assignment.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(assignment.id)
    assert data["user_id"] == str(bdm_user.id)


@pytest.mark.asyncio
async def test_update_assignment(client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession):
    """Admin can update an assignment"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id, is_active=True)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    payload = {"is_active": False}
    res = await client.patch(f"/api/assignments/{assignment.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_delete_assignment(client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession):
    """Admin can delete an assignment"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    res = await client.delete(f"/api/assignments/{assignment.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/assignments/{assignment.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_update_assignment_account_and_program(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Admin can update both account and program on an existing assignment"""
    account1 = await create_test_account(db)
    account2 = await create_test_account(db)
    program1 = await create_test_program(db)
    program2 = await create_test_program(db)

    assignment = Assignment(user_id=bdm_user.id, account_id=account1.id, program_id=program1.id)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    payload = {"account_id": str(account2.id), "program_id": str(program2.id)}
    res = await client.patch(
        f"/api/assignments/{assignment.id}", json=payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["account_id"] == str(account2.id)
    assert data["program_id"] == str(program2.id)


@pytest.mark.asyncio
async def test_inactive_assignments_hidden_from_bdm(
    client: AsyncClient, bdm_token: str, admin_token: str, bdm_user: User, db: AsyncSession
):
    """BDM my-assignments only returns active assignments; inactive ones are hidden"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    # Create an INACTIVE assignment for this BDM
    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id, is_active=False)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    res = await client.get("/api/assignments/my", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    # The inactive assignment must NOT appear in BDM's my-assignments
    assignment_ids = [item["id"] for item in items]
    assert str(assignment.id) not in assignment_ids


@pytest.mark.asyncio
async def test_active_assignment_visible_to_bdm(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """BDM sees an assignment when it is active"""
    account = await create_test_account(db)
    program = await create_test_program(db)

    assignment = Assignment(user_id=bdm_user.id, account_id=account.id, program_id=program.id, is_active=True)
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)

    res = await client.get("/api/assignments/my", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    items = res.json()["items"]
    assignment_ids = [item["id"] for item in items]
    assert str(assignment.id) in assignment_ids
