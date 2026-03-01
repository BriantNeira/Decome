import pytest
from httpx import AsyncClient

from app.models import User


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient, admin_token: str):
    res = await client.get("/api/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert "items" in res.json()


@pytest.mark.asyncio
async def test_bdm_cannot_list_users(client: AsyncClient, bdm_token: str):
    res = await client.get("/api/users", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_director_cannot_list_users(client: AsyncClient, director_token: str):
    res = await client.get("/api/users", headers={"Authorization": f"Bearer {director_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_cannot_list_users(client: AsyncClient):
    res = await client.get("/api/users")
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_get_single_user(client: AsyncClient, admin_token: str, bdm_user: User):
    res = await client.get(f"/api/users/{bdm_user.id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    assert res.json()["email"] == bdm_user.email


@pytest.mark.asyncio
async def test_bdm_cannot_get_user(client: AsyncClient, bdm_token: str, admin_user: User):
    res = await client.get(f"/api/users/{admin_user.id}", headers={"Authorization": f"Bearer {bdm_token}"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_update_user(client: AsyncClient, admin_token: str, bdm_user: User):
    res = await client.patch(
        f"/api/users/{bdm_user.id}",
        json={"full_name": "Updated BDM Name"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "Updated BDM Name"


@pytest.mark.asyncio
async def test_bdm_cannot_update_user(client: AsyncClient, bdm_token: str, admin_user: User):
    res = await client.patch(
        f"/api/users/{admin_user.id}",
        json={"full_name": "Hacked"},
        headers={"Authorization": f"Bearer {bdm_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_branding_public_no_auth_required(client: AsyncClient):
    res = await client.get("/api/branding")
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_bdm_cannot_upload_branding(client: AsyncClient, bdm_token: str):
    from io import BytesIO
    data = {"file": ("logo.png", BytesIO(b"fake"), "image/png")}
    res = await client.post(
        "/api/branding/logo",
        files=data,
        headers={"Authorization": f"Bearer {bdm_token}"},
    )
    assert res.status_code == 403
