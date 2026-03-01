import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models import User

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.mark.asyncio
async def test_login_creates_audit_log(client: AsyncClient, admin_user: User, db: AsyncSession):
    await client.post("/api/auth/login", json={
        "email": admin_user.email, "password": "Test123!"
    })
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "LOGIN_SUCCESS")
        .where(AuditLog.user_id == admin_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()
    assert log is not None
    assert log.details is not None


@pytest.mark.asyncio
async def test_failed_login_creates_audit_log(client: AsyncClient, admin_user: User, db: AsyncSession):
    await client.post("/api/auth/login", json={
        "email": admin_user.email, "password": "wrongpassword"
    })
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "LOGIN_FAILED")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()
    assert log is not None


@pytest.mark.asyncio
async def test_user_creation_creates_audit_log(client: AsyncClient, admin_token: str, db: AsyncSession):
    await client.post("/api/auth/register", json={
        "email": "auditcheck@test.example",
        "password": "AuditTest1!",
        "full_name": "Audit Check",
        "role": "bdm",
    }, headers={"Authorization": f"Bearer {admin_token}"})

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "USER_CREATED")
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()
    assert log is not None
    assert log.resource_type == "user"


@pytest.mark.asyncio
async def test_logout_creates_audit_log(client: AsyncClient, admin_token: str, admin_user: User, db: AsyncSession):
    await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {admin_token}"})
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "LOGOUT")
        .where(AuditLog.user_id == admin_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    log = result.scalar_one_or_none()
    assert log is not None


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["db"] is True
