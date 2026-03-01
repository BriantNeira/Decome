from fastapi import Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User


def require_roles(*allowed_roles: str):
    """FastAPI dependency factory that enforces role-based access."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions.",
            )
        return current_user

    return role_checker
