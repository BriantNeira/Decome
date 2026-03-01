"""
Seed script: python -m app.seed
Creates default roles and admin user (idempotent).
"""
import asyncio
import logging

from sqlalchemy import select

from app.database import async_session_factory, engine
from app.models import AuditLog, BrandingConfig, Role, User  # noqa: F401 — registers models
from app.database import Base
from app.utils.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ROLES = [
    {"name": "admin", "description": "Platform administrator"},
    {"name": "bdm", "description": "Business Development Manager"},
    {"name": "director", "description": "Director / Team Lead"},
]

ADMIN_USER = {
    "email": "admin@decome.local",
    "password": "Admin123!",
    "full_name": "System Admin",
    "role": "admin",
}


async def seed() -> None:
    async with async_session_factory() as db:
        # Seed roles
        for role_data in ROLES:
            result = await db.execute(select(Role).where(Role.name == role_data["name"]))
            if not result.scalar_one_or_none():
                db.add(Role(**role_data))
                logger.info("Created role: %s", role_data["name"])
        await db.commit()

        # Seed admin user
        result = await db.execute(select(User).where(User.email == ADMIN_USER["email"]))
        if not result.scalar_one_or_none():
            role_result = await db.execute(select(Role).where(Role.name == ADMIN_USER["role"]))
            admin_role = role_result.scalar_one()
            db.add(
                User(
                    email=ADMIN_USER["email"],
                    hashed_password=hash_password(ADMIN_USER["password"]),
                    full_name=ADMIN_USER["full_name"],
                    role_id=admin_role.id,
                )
            )
            logger.info("Created admin user: %s", ADMIN_USER["email"])
        await db.commit()

        # Seed branding config (singleton)
        result = await db.execute(select(BrandingConfig).limit(1))
        if not result.scalar_one_or_none():
            db.add(BrandingConfig())
            logger.info("Created default branding config")
        await db.commit()

    logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
