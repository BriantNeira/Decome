import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ReminderType


@pytest.mark.asyncio
async def test_list_reminder_types_admin(client: AsyncClient, admin_token: str):
    """Admin can list all reminder types"""
    res = await client.get("/api/reminder-types", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    # Check seeded reminder types
    assert len(data["items"]) >= 5


@pytest.mark.asyncio
async def test_list_reminder_types_bdm_allowed(client: AsyncClient, bdm_token: str):
    """BDM can list reminder types (read-only for calendar/reminders)"""
    res = await client.get("/api/reminder-types", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_create_reminder_type_admin(client: AsyncClient, admin_token: str):
    """Admin can create a reminder type"""
    payload = {
        "name": "Test Reminder",
        "description": "A test reminder type",
        "color": "#FF0000",
    }
    res = await client.post("/api/reminder-types", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Reminder"
    assert data["description"] == "A test reminder type"
    assert data["color"] == "#FF0000"
    assert data["is_active"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_reminder_type_duplicate_name(client: AsyncClient, admin_token: str):
    """Cannot create reminder type with duplicate name"""
    payload = {"name": "Unique Reminder", "description": "First"}
    res1 = await client.post("/api/reminder-types", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res1.status_code == 201

    payload2 = {"name": "Unique Reminder", "description": "Second"}
    res2 = await client.post("/api/reminder-types", json=payload2, headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 400


@pytest.mark.asyncio
async def test_create_reminder_type_bdm_forbidden(client: AsyncClient, bdm_token: str):
    """BDM cannot create reminder type"""
    payload = {"name": "Test", "description": "Test"}
    res = await client.post("/api/reminder-types", json=payload, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_reminder_type(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can get a single reminder type"""
    reminder_type = ReminderType(name="Get Test", description="Test get", color="#00FF00")
    db.add(reminder_type)
    await db.commit()
    await db.refresh(reminder_type)

    res = await client.get(f"/api/reminder-types/{reminder_type.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == reminder_type.id
    assert data["name"] == "Get Test"
    assert data["color"] == "#00FF00"


@pytest.mark.asyncio
async def test_update_reminder_type(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can update a reminder type"""
    reminder_type = ReminderType(name="Original", description="Original", color="#0000FF")
    db.add(reminder_type)
    await db.commit()
    await db.refresh(reminder_type)

    payload = {"name": "Updated", "description": "Updated", "color": "#FFFFFF"}
    res = await client.patch(f"/api/reminder-types/{reminder_type.id}", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Updated"
    assert data["description"] == "Updated"
    assert data["color"] == "#FFFFFF"


@pytest.mark.asyncio
async def test_delete_reminder_type(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Admin can delete a reminder type"""
    reminder_type = ReminderType(name="Delete Test", description="Test", color="#123456")
    db.add(reminder_type)
    await db.commit()
    await db.refresh(reminder_type)

    res = await client.delete(f"/api/reminder-types/{reminder_type.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

    # Verify deletion
    res2 = await client.get(f"/api/reminder-types/{reminder_type.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_reminder_type_audit_log_on_create(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Creating a reminder type should generate audit log"""
    from app.models.audit_log import AuditLog
    from sqlalchemy import select

    payload = {"name": "Audit Test Unique", "description": "Test audit", "color": "#AABBCC"}
    res = await client.post("/api/reminder-types", json=payload, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201
    reminder_type_id = res.json()["id"]

    # Check audit log
    result = await db.execute(
        select(AuditLog).where(
            (AuditLog.action == "REMINDER_TYPE_CREATED") & (AuditLog.resource_id == str(reminder_type_id))
        )
    )
    audit = result.scalar_one_or_none()
    assert audit is not None
    assert audit.action == "REMINDER_TYPE_CREATED"
