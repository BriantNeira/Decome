"""LLM configuration endpoints (admin only)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.llm_config import LLMConfigRead, LLMConfigUpdate
from app.services import llm_service

router = APIRouter(prefix="/api/llm-config", tags=["llm-config"])


def _to_read(config) -> dict:
    return {
        "provider": config.provider,
        "model": config.model,
        "api_key_set": bool(config.api_key),
        "max_tokens_per_request": config.max_tokens_per_request,
        "is_active": config.is_active,
        "updated_at": config.updated_at,
    }


@router.get("", response_model=LLMConfigRead)
async def get_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await llm_service.get_llm_config(db)
    if config is None:
        import datetime
        # Return defaults
        return LLMConfigRead(
            provider="openai",
            model="gpt-4o-mini",
            api_key_set=False,
            max_tokens_per_request=1500,
            is_active=False,
            updated_at=datetime.datetime.now(),
        )
    return LLMConfigRead(**_to_read(config))


@router.patch("", response_model=LLMConfigRead)
async def update_config(
    body: LLMConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    fields = body.model_dump(exclude_none=True)
    fields["updated_by_id"] = current_user.id
    config = await llm_service.upsert_llm_config(db, **fields)
    return LLMConfigRead(**_to_read(config))


@router.get("/models")
async def get_available_models(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Return available model IDs for the currently-configured provider."""
    config = await llm_service.get_llm_config(db)
    if config is None or not config.api_key:
        return {"models": []}
    models = await llm_service.list_models(config)
    return {"models": models}


@router.post("/test")
async def test_connection(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    config = await llm_service.get_llm_config(db)
    if config is None or not config.api_key:
        return {"ok": False, "message": "LLM not configured. Set provider, API key and model first."}
    ok, message = await llm_service.test_connection(config)
    return {"ok": ok, "message": message}
