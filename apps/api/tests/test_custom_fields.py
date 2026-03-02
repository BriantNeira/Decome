import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import CustomFieldDefinition, CustomFieldValue


@pytest.mark.asyncio
async def test_list_definitions_admin(client: AsyncClient, admin_token: str):
    """Admin can list custom field definitions"""
    res = await client.get("/api/custom-fields/definitions", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


@pytest.mark.asyncio
async def test_list_definitions_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot list custom field definitions"""
    res = await client.get("/api/custom-fields/definitions", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_create_definition_admin(client: AsyncClient, admin_token: str):
    """Admin can create a custom field definition"""
    payload = {
        "field_name": "Department",
        "field_type": "text",
        "entity_type": "account",
        "is_required": False,
        "sort_order": 1,
    }
    res = await client.post("/api/custom-fields/definitions", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["field_name"] == "Department"
    assert data["field_type"] == "text"
    assert data["entity_type"] == "account"
    assert data["is_required"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_create_definition_with_options(client: AsyncClient, admin_token: str):
    """Admin can create a dropdown definition with choices options"""
    payload = {
        "field_name": "Status",
        "field_type": "dropdown",
        "entity_type": "contact",
        "is_required": True,
        "options": {"choices": ["Active", "Inactive", "Pending"]},
        "sort_order": 2,
    }
    res = await client.post("/api/custom-fields/definitions", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["field_name"] == "Status"
    assert data["field_type"] == "dropdown"
    assert data["options"] == {"choices": ["Active", "Inactive", "Pending"]}


@pytest.mark.asyncio
async def test_create_definition_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot create custom field definition"""
    payload = {
        "field_name": "Test",
        "field_type": "text",
        "entity_type": "account",
        "is_required": False,
    }
    res = await client.post("/api/custom-fields/definitions", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_definition(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get a single definition"""
    definition = CustomFieldDefinition(
        field_name="Test Field",
        field_type="text",
        entity_type="account",
        is_required=False,
        sort_order=1,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    res = await client.get(f"/api/custom-fields/definitions/{definition.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == definition.id
    assert data["field_name"] == "Test Field"


@pytest.mark.asyncio
async def test_update_definition(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update a definition"""
    definition = CustomFieldDefinition(
        field_name="Original",
        field_type="text",
        entity_type="account",
        is_required=False,
        sort_order=1,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    payload = {"is_required": True, "sort_order": 2}
    res = await client.patch(f"/api/custom-fields/definitions/{definition.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["is_required"] is True
    assert data["sort_order"] == 2


@pytest.mark.asyncio
async def test_delete_definition(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete a definition"""
    definition = CustomFieldDefinition(
        field_name="Delete Test",
        field_type="text",
        entity_type="account",
        is_required=False,
        sort_order=1,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    res = await client.delete(f"/api/custom-fields/definitions/{definition.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/custom-fields/definitions/{definition.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_get_values_for_entity(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get custom field values for an entity"""
    import uuid

    definition = CustomFieldDefinition(
        field_name="Test",
        field_type="text",
        entity_type="account",
        is_required=False,
        sort_order=1,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    entity_id = str(uuid.uuid4())
    value = CustomFieldValue(definition_id=definition.id, entity_id=entity_id, value="Test Value")
    db.add(value)
    await db.commit()

    res = await client.get(f"/api/custom-fields/values/account/{entity_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "values" in data


@pytest.mark.asyncio
async def test_set_values_for_entity(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can set custom field values for an entity"""
    import uuid

    definition = CustomFieldDefinition(
        field_name="Test",
        field_type="text",
        entity_type="account",
        is_required=False,
        sort_order=1,
    )
    db.add(definition)
    await db.commit()
    await db.refresh(definition)

    entity_id = str(uuid.uuid4())
    payload = {"values": [{"definition_id": definition.id, "value": "New Value"}]}

    res = await client.put(f"/api/custom-fields/values/account/{entity_id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "count" in data


@pytest.mark.asyncio
async def test_set_values_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot set custom field values"""
    import uuid

    entity_id = str(uuid.uuid4())
    payload = {"values": []}

    res = await client.put(f"/api/custom-fields/values/account/{entity_id}", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403
