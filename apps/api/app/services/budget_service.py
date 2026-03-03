"""Token budget management and usage logging."""
from __future__ import annotations

import uuid
import datetime

from fastapi import HTTPException
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.token_budget import TokenBudget
from app.models.token_usage_log import TokenUsageLog
from app.models.user import User


async def get_budget(db: AsyncSession, user_id: uuid.UUID) -> TokenBudget | None:
    result = await db.execute(
        select(TokenBudget).where(TokenBudget.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def set_budget(db: AsyncSession, user_id: uuid.UUID, monthly_limit: int) -> TokenBudget:
    obj = await get_budget(db, user_id)
    if obj is None:
        obj = TokenBudget(user_id=user_id, monthly_limit=monthly_limit)
        db.add(obj)
    else:
        obj.monthly_limit = monthly_limit
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_monthly_usage(db: AsyncSession, user_id: uuid.UUID) -> int:
    now = datetime.datetime.now(datetime.timezone.utc)
    result = await db.execute(
        select(func.coalesce(func.sum(TokenUsageLog.tokens_used), 0)).where(
            TokenUsageLog.user_id == user_id,
            extract("year", TokenUsageLog.generated_at) == now.year,
            extract("month", TokenUsageLog.generated_at) == now.month,
        )
    )
    return int(result.scalar_one())


async def check_budget(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Raise 422 if the user has exceeded their monthly token budget."""
    budget = await get_budget(db, user_id)
    if budget is None or budget.monthly_limit == 0:
        return  # unlimited
    used = await get_monthly_usage(db, user_id)
    if used >= budget.monthly_limit:
        raise HTTPException(
            status_code=422,
            detail=f"Monthly token budget exceeded ({used}/{budget.monthly_limit}). Contact your Admin.",
        )


async def log_usage(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID | None,
    reminder_id: uuid.UUID | None,
    tokens: int,
    provider: str,
    model: str,
) -> TokenUsageLog:
    log = TokenUsageLog(
        user_id=user_id,
        account_id=account_id,
        reminder_id=reminder_id,
        tokens_used=tokens,
        provider=provider,
        model=model,
    )
    db.add(log)
    await db.commit()
    return log


async def list_all_budgets_with_usage(db: AsyncSession) -> list[dict]:
    """Admin view: all users with their budget and current month usage."""
    users_result = await db.execute(select(User).order_by(User.full_name))
    users = users_result.scalars().all()

    result = []
    now = datetime.datetime.now(datetime.timezone.utc)
    for user in users:
        budget = await get_budget(db, user.id)
        used = await get_monthly_usage(db, user.id)
        monthly_limit = budget.monthly_limit if budget else 0
        remaining = max(0, monthly_limit - used) if monthly_limit > 0 else None
        result.append({
            "user_id": str(user.id),
            "user_name": user.full_name,
            "user_email": user.email,
            "monthly_limit": monthly_limit,
            "tokens_used_this_month": used,
            "remaining": remaining,
            "budget_id": budget.id if budget else None,
        })
    return result
