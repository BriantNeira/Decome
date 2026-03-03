"""Tests for Microsoft Graph email service."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.graph_email_service import (
    send_graph_email,
    check_graph_connection,
    _acquire_token,
    _get_decrypted_secret,
)
from app.utils.security import encrypt_field


def _make_config(
    tenant_id="test-tenant",
    client_id="test-client",
    client_secret="test-secret",
    from_email="sender@example.com",
    is_active=True,
):
    """Create a mock GraphEmailConfig."""
    config = MagicMock()
    config.tenant_id = tenant_id
    config.client_id = client_id
    config.client_secret = encrypt_field(client_secret) if client_secret else None
    config.from_email = from_email
    config.is_active = is_active
    return config


def test_get_decrypted_secret():
    """Decrypting the stored secret should return the original."""
    config = _make_config(client_secret="my-super-secret")
    assert _get_decrypted_secret(config) == "my-super-secret"


def test_get_decrypted_secret_none():
    """None client_secret returns None."""
    config = _make_config(client_secret=None)
    config.client_secret = None
    assert _get_decrypted_secret(config) is None


@pytest.mark.asyncio
async def test_acquire_token_success():
    """Should acquire token via MSAL."""
    config = _make_config()

    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {"access_token": "test-token-123"}

    with patch("app.services.graph_email_service.msal") as mock_msal:
        mock_msal.ConfidentialClientApplication.return_value = mock_app
        token = await _acquire_token(config)

    assert token == "test-token-123"
    mock_msal.ConfidentialClientApplication.assert_called_once()


@pytest.mark.asyncio
async def test_acquire_token_failure():
    """Should raise HTTPException on token acquisition failure."""
    from fastapi import HTTPException

    config = _make_config()

    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {
        "error": "invalid_client",
        "error_description": "Client secret is invalid",
    }

    with patch("app.services.graph_email_service.msal") as mock_msal:
        mock_msal.ConfidentialClientApplication.return_value = mock_app
        with pytest.raises(HTTPException) as exc_info:
            await _acquire_token(config)
        assert exc_info.value.status_code == 502


@pytest.mark.asyncio
async def test_test_graph_connection_success():
    """test_graph_connection should return (True, msg) on success."""
    config = _make_config()

    with patch("app.services.graph_email_service._acquire_token", new_callable=AsyncMock) as mock:
        mock.return_value = "test-token"
        ok, msg = await check_graph_connection(config)

    assert ok is True
    assert "Connected" in msg


@pytest.mark.asyncio
async def test_test_graph_connection_failure():
    """test_graph_connection should return (False, msg) on failure."""
    config = _make_config()

    with patch("app.services.graph_email_service._acquire_token", new_callable=AsyncMock) as mock:
        from fastapi import HTTPException
        mock.side_effect = HTTPException(status_code=502, detail="Token failed")
        ok, msg = await check_graph_connection(config)

    assert ok is False
    assert "Token failed" in msg


@pytest.mark.asyncio
async def test_send_graph_email_success():
    """send_graph_email should POST to Graph API."""
    config = _make_config()

    mock_response = MagicMock()
    mock_response.status_code = 202
    mock_response.text = ""

    with patch("app.services.graph_email_service._acquire_token", new_callable=AsyncMock) as mock_token:
        mock_token.return_value = "test-token"

        with patch("app.services.graph_email_service.httpx") as mock_httpx:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_httpx.AsyncClient.return_value = mock_client

            await send_graph_email(
                config,
                to_email="recipient@example.com",
                subject="Test Subject",
                html_body="<p>Hello</p>",
            )

            mock_client.post.assert_called_once()
            call_args = mock_client.post.call_args
            assert "sendMail" in call_args[0][0]


@pytest.mark.asyncio
async def test_send_graph_email_failure():
    """send_graph_email should raise on non-2xx response."""
    from fastapi import HTTPException

    config = _make_config()

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Forbidden"

    with patch("app.services.graph_email_service._acquire_token", new_callable=AsyncMock) as mock_token:
        mock_token.return_value = "test-token"

        with patch("app.services.graph_email_service.httpx") as mock_httpx:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_httpx.AsyncClient.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await send_graph_email(
                    config,
                    to_email="recipient@example.com",
                    subject="Test",
                    html_body="<p>Fail</p>",
                )
            assert exc_info.value.status_code == 502
