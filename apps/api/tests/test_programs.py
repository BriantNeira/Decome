import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Program


@pytest.mark.asyncio
async def test_list_programs_admin(client: AsyncClient, admin_token: str):
    """Admin can list all programs"""
    res = await client.get("/api/programs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    # Check that default N/A program is included
    na_program = next((p for p in data["items"] if p["is_default"]), None)
    assert na_program is not None
    assert na_program["name"] == "N/A"


@pytest.mark.asyncio
async def test_list_programs_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot list programs"""
    res = await client.get("/api/programs", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_program_admin(client: AsyncClient, admin_token: str):
    """Admin can create a program"""
    payload = {
        "name": "Test Program",
        "description": "A test program",
    }
    res = await client.post("/api/programs", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Program"
    assert data["description"] == "A test program"
    assert data["is_active"] is True
    assert data["is_default"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_create_program_duplicate_name(client: AsyncClient, admin_token: str):
    """Cannot create program with duplicate name"""
    payload = {"name": "Unique Program", "description": "First"}
    res1 = await client.post("/api/programs", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res1.status_code == 201

    payload2 = {"name": "Unique Program", "description": "Second"}
    res2 = await client.post("/api/programs", json=payload2, headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 400


@pytest.mark.asyncio
async def test_create_program_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot create program"""
    payload = {"name": "Test", "description": "Test"}
    res = await client.post("/api/programs", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_program(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get a single program"""
    program = Program(name="Get Test Program", description="Test get")
    db.add(program)
    await db.commit()
    await db.refresh(program)

    res = await client.get(f"/api/programs/{program.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(program.id)
    assert data["name"] == "Get Test Program"


@pytest.mark.asyncio
async def test_update_program(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update a program"""
    program = Program(name="Original Program", description="Original")
    db.add(program)
    await db.commit()
    await db.refresh(program)

    payload = {"name": "Updated Program", "description": "Updated"}
    res = await client.patch(f"/api/programs/{program.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Updated Program"
    assert data["description"] == "Updated"


@pytest.mark.asyncio
async def test_can_rename_any_program(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can rename any program including the legacy default one"""
    from sqlalchemy import select
    result = await db.execute(select(Program).where(Program.is_default == True))
    default_program = result.scalar_one_or_none()
    if default_program is None:
        pytest.skip("No default program in DB")

    payload = {"name": "Renamed Default"}
    res = await client.patch(f"/api/programs/{default_program.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["name"] == "Renamed Default"


@pytest.mark.asyncio
async def test_can_delete_program_without_active_assignments(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete any program that has no active assignments"""
    program = Program(name="Deletable Program", description="Test", is_default=False)
    db.add(program)
    await db.commit()
    await db.refresh(program)

    res = await client.delete(f"/api/programs/{program.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_delete_program(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete a non-default program"""
    program = Program(name="Delete Program", description="Test", is_default=False)
    db.add(program)
    await db.commit()
    await db.refresh(program)

    res = await client.delete(f"/api/programs/{program.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/programs/{program.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404
