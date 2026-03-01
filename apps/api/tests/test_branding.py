import io

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.mark.asyncio
async def test_get_branding_public(client: AsyncClient):
    """Branding config is accessible without auth."""
    res = await client.get("/api/branding")
    assert res.status_code == 200
    data = res.json()
    assert "logo_light_url" in data
    assert "logo_dark_url" in data
    assert "favicon_url" in data


@pytest.mark.asyncio
async def test_admin_upload_logo(client: AsyncClient, admin_token: str):
    # Create a minimal valid PNG (1x1 px)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    res = await client.post(
        "/api/branding/logo?variant=light",
        files={"file": ("logo.png", io.BytesIO(png_bytes), "image/png")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "filename" in data
    assert "url" in data


@pytest.mark.asyncio
async def test_admin_upload_invalid_file_type(client: AsyncClient, admin_token: str):
    res = await client.post(
        "/api/branding/logo?variant=light",
        files={"file": ("logo.gif", io.BytesIO(b"GIF89a"), "image/gif")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_admin_upload_favicon(client: AsyncClient, admin_token: str):
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    res = await client.post(
        "/api/branding/favicon",
        files={"file": ("favicon.png", io.BytesIO(png_bytes), "image/png")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_branding_logo_url_in_config_after_upload(client: AsyncClient, admin_token: str):
    """After uploading a logo, the branding config should show the URL."""
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    await client.post(
        "/api/branding/logo?variant=light",
        files={"file": ("logo2.png", io.BytesIO(png_bytes), "image/png")},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    res = await client.get("/api/branding")
    assert res.status_code == 200
    assert res.json()["logo_light_url"] is not None


@pytest.mark.asyncio
async def test_delete_logo(client: AsyncClient, admin_token: str):
    res = await client.delete(
        "/api/branding/logo?variant=light",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
