"""Token budget management."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user, require_roles
from app.models.user import User
from app.schemas.token_budget import BudgetUsageSummary, TokenBudgetCreate, TokenBudgetRead, TokenBudgetUpdate
from app.services import budget_service

router = APIRouter(prefix="/api/token-budgets", tags=["token-budgets"])


@router.get("", response_model=list[BudgetUsageSummary])
async def list_budgets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        return await budget_service.list_all_budgets_with_usage(db)
    # BDM/Director: return own usage
    used = await budget_service.get_monthly_usage(db, current_user.id)
    budget = await budget_service.get_budget(db, current_user.id)
    monthly_limit = budget.monthly_limit if budget else 0
    remaining = max(0, monthly_limit - used) if monthly_limit > 0 else None
    return [BudgetUsageSummary(
        user_id=str(current_user.id),
        user_name=current_user.full_name,
        user_email=current_user.email,
        monthly_limit=monthly_limit,
        tokens_used_this_month=used,
        remaining=remaining,
        budget_id=budget.id if budget else None,
    )]


@router.post("", response_model=TokenBudgetRead, status_code=201)
async def create_budget(
    body: TokenBudgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    obj = await budget_service.set_budget(db, body.user_id, body.monthly_limit)
    return TokenBudgetRead.model_validate(obj)


@router.patch("/{budget_id}", response_model=TokenBudgetRead)
async def update_budget(
    budget_id: int,
    body: TokenBudgetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    from sqlalchemy import select
    from app.models.token_budget import TokenBudget
    result = await db.execute(select(TokenBudget).where(TokenBudget.id == budget_id))
    obj = result.scalar_one_or_none()
    if obj is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    obj.monthly_limit = body.monthly_limit
    await db.commit()
    await db.refresh(obj)
    return TokenBudgetRead.model_validate(obj)
