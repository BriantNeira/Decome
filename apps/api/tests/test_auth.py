import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user: User):
    res = await client.post("/api/auth/login", json={
        "email": admin_user.email, "password": "Test123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["requires_2fa"] is False


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, admin_user: User):
    res = await client.post("/api/auth/login", json={
        "email": admin_user.email, "password": "wrongpassword"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    res = await client.post("/api/auth/login", json={
        "email": "nobody@nowhere.com", "password": "Test123!"
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db: AsyncSession, bdm_user: User):
    await db.execute(update(User).where(User.id == bdm_user.id).values(is_active=False))
    await db.commit()
    res = await client.post("/api/auth/login", json={
        "email": bdm_user.email, "password": "Test123!"
    })
    assert res.status_code == 401
    # Restore
    await db.execute(update(User).where(User.id == bdm_user.id).values(is_active=True))
    await db.commit()


@pytest.mark.asyncio
async def test_me_returns_current_user(client: AsyncClient, admin_token: str, admin_user: User):
    res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == admin_user.email
    assert data["role"] == "admin"


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    res = await client.get("/api/auth/me")
    assert res.status_code == 401  # HTTPBearer returns 401 when no Authorization header


@pytest.mark.asyncio
async def test_me_invalid_token(client: AsyncClient):
    res = await client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_register_admin_only(client: AsyncClient, admin_token: str, bdm_token: str):
    # Admin can register
    res = await client.post("/api/auth/register", json={
        "email": "newbdm@test.example",
        "password": "NewPass1!",
        "full_name": "New BDM",
        "role": "bdm",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 201

    # BDM cannot register
    res2 = await client.post("/api/auth/register", json={
        "email": "another@test.example",
        "password": "NewPass1!",
        "full_name": "Another",
        "role": "bdm",
    }, headers={"Authorization": f"Bearer {bdm_token}"})
    assert res2.status_code == 403


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, admin_token: str, admin_user: User):
    res = await client.post("/api/auth/register", json={
        "email": admin_user.email,
        "password": "NewPass1!",
        "full_name": "Duplicate",
        "role": "bdm",
    }, headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_password_reset_request_always_succeeds(client: AsyncClient):
    # Should return 200 whether or not email exists
    res = await client.post("/api/auth/password-reset/request", json={
        "email": "doesnotexist@test.example"
    })
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_password_reset_invalid_token(client: AsyncClient):
    res = await client.post("/api/auth/password-reset/confirm", json={
        "token": "totally-invalid-token",
        "new_password": "NewPass1!"
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_2fa_setup_requires_auth(client: AsyncClient):
    res = await client.post("/api/auth/2fa/setup")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_2fa_setup_and_enable(client: AsyncClient, director_token: str, director_user: User, db: AsyncSession):
    # Setup
    res = await client.post("/api/auth/2fa/setup", headers={"Authorization": f"Bearer {director_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "uri" in data
    assert "secret" in data

    # Enable with invalid code
    res2 = await client.post("/api/auth/2fa/enable",
        json={"code": "000000"},
        headers={"Authorization": f"Bearer {director_token}"}
    )
    assert res2.status_code == 400

    # Cleanup: remove totp_secret so future tests are clean
    await db.execute(
        update(User).where(User.id == director_user.id).values(totp_secret=None, totp_enabled=False)
    )
    await db.commit()


@pytest.mark.asyncio
async def test_logout(client: AsyncClient, admin_token: str):
    res = await client.post("/api/auth/logout", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
