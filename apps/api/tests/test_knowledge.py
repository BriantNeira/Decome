"""Tests for knowledge base service."""
import sys
import pytest
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.utils.security import encrypt_field


def make_mock_config():
    config = MagicMock()
    config.provider = "openai"
    config.model = "gpt-4o-mini"
    config.api_key = encrypt_field("sk-test")
    config.max_tokens_per_request = 1500
    config.is_active = True
    return config


def test_extract_text_invalid_type():
    """_extract_text returns empty string for unknown type."""
    from app.services.knowledge_service import _extract_text
    result = _extract_text(Path("/tmp/fake.txt"), "txt")
    assert result == ""


@pytest.mark.asyncio
async def test_upload_document_invalid_extension():
    """upload_document raises 422 for non-allowed file types."""
    from app.services.knowledge_service import upload_document
    from fastapi import HTTPException

    mock_file = MagicMock()
    mock_file.filename = "report.csv"
    mock_file.read = AsyncMock(return_value=b"col1,col2")

    db = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await upload_document(db, uuid.uuid4(), mock_file, uuid.uuid4())
    assert exc_info.value.status_code == 422
    assert "not allowed" in exc_info.value.detail


@pytest.mark.asyncio
async def test_upload_document_too_large():
    """upload_document raises 422 for files > 10 MB."""
    from app.services.knowledge_service import upload_document, MAX_FILE_SIZE
    from fastapi import HTTPException

    mock_file = MagicMock()
    mock_file.filename = "large.pdf"
    mock_file.read = AsyncMock(return_value=b"x" * (MAX_FILE_SIZE + 1))

    db = AsyncMock()
    with pytest.raises(HTTPException) as exc_info:
        await upload_document(db, uuid.uuid4(), mock_file, uuid.uuid4())
    assert exc_info.value.status_code == 422
    assert "10 MB" in exc_info.value.detail


@pytest.mark.asyncio
async def test_build_profile_no_llm_config():
    """build_profile raises 422 when LLM not configured."""
    from app.services.knowledge_service import build_profile
    from fastapi import HTTPException

    db = AsyncMock()
    # llm_service is imported inside build_profile, so patch at source
    with patch("app.services.llm_service.get_llm_config", new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc_info:
            await build_profile(db, uuid.uuid4(), uuid.uuid4())
        assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_generate_profile_llm_mock():
    """Test generate_profile with mocked OpenAI response."""
    from app.services.llm_service import generate_profile

    config = make_mock_config()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "This is a professional customer profile."
    mock_response.usage.total_tokens = 80

    mock_openai_module = MagicMock()
    mock_client = AsyncMock()
    mock_openai_module.AsyncOpenAI.return_value = mock_client
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with patch.dict(sys.modules, {"openai": mock_openai_module}):
        profile_text, tokens = await generate_profile(
            config,
            account_name="Acme Corp",
            knowledge={"website": "acme.com", "industry": "Tech", "account_type": "Enterprise", "observations": ""},
            docs_text="Annual report content here.",
            notes_text="Q1 meeting went well.",
        )
        assert "customer profile" in profile_text.lower() or len(profile_text) > 5
        assert tokens == 80
