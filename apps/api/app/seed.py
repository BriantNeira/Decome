"""
Seed script: python -m app.seed
Creates default roles and admin user (idempotent).
"""
import asyncio
import logging

from sqlalchemy import select

from app.database import async_session_factory, engine
from app.models import (  # noqa: F401 — registers models
    AuditLog,
    Account,
    Assignment,
    BrandingConfig,
    Contact,
    CustomFieldDefinition,
    CustomFieldValue,
    Program,
    ReminderType,
    Role,
    User,
)
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
    "email": "admin@decome.app",
    "password": "Admin123!",
    "full_name": "System Admin",
    "role": "admin",
}

SEED_USERS = [
    {
        "email": "maria.lopez@decome.app",
        "password": "Bdm123!",
        "full_name": "Maria Lopez",
        "role": "bdm",
    },
    {
        "email": "director@decome.app",
        "password": "Director123!",
        "full_name": "Carlos Director",
        "role": "director",
    },
]


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

        # Seed additional users (BDM, director)
        for user_data in SEED_USERS:
            result = await db.execute(select(User).where(User.email == user_data["email"]))
            if not result.scalar_one_or_none():
                role_result = await db.execute(select(Role).where(Role.name == user_data["role"]))
                role = role_result.scalar_one()
                db.add(
                    User(
                        email=user_data["email"],
                        hashed_password=hash_password(user_data["password"]),
                        full_name=user_data["full_name"],
                        role_id=role.id,
                    )
                )
                logger.info("Created user: %s (%s)", user_data["email"], user_data["role"])
        await db.commit()

        # Seed branding config (singleton)
        result = await db.execute(select(BrandingConfig).limit(1))
        if not result.scalar_one_or_none():
            db.add(BrandingConfig())
            logger.info("Created default branding config")
        await db.commit()

        # Seed default "N/A" program
        result = await db.execute(select(Program).where(Program.is_default == True))
        if not result.scalar_one_or_none():
            db.add(
                Program(
                    name="N/A",
                    description="Default program for accounts without a specific program",
                    is_default=True,
                )
            )
            logger.info("Created default N/A program")
        await db.commit()

        # Seed sample reminder types
        REMINDER_TYPES = [
            {
                "name": "Follow-up Call",
                "description": "Scheduled follow-up call with client",
                "color": "#2563EB",
            },
            {
                "name": "Payment Review",
                "description": "Review payment status or credit terms",
                "color": "#DC2626",
            },
            {
                "name": "Contract Renewal",
                "description": "Contract renewal discussion",
                "color": "#F59E0B",
            },
            {
                "name": "Courtesy Visit",
                "description": "General relationship maintenance visit",
                "color": "#10B981",
            },
            {"name": "Other", "description": "General reminder", "color": "#6B7280"},
        ]
        for rt_data in REMINDER_TYPES:
            result = await db.execute(
                select(ReminderType).where(ReminderType.name == rt_data["name"])
            )
            if not result.scalar_one_or_none():
                db.add(ReminderType(**rt_data))
                logger.info("Created reminder type: %s", rt_data["name"])
        await db.commit()

    logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
