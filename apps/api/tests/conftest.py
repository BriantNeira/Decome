from typing import AsyncGenerator

import pytest
import pytest_asyncio

# Make every async test in this directory use the session-scoped event loop,
# matching the session-scoped setup_db fixture and function-scoped fixtures
# that all run in the same session event loop (asyncio_default_fixture_loop_scope=session).
pytestmark = pytest.mark.asyncio(loop_scope="session")
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.main import app
from app.models import Role, User  # noqa: F401
from app.models.branding import BrandingConfig  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.utils.security import hash_password

TEST_DB_URL = "postgresql+asyncpg://decome:decome_dev_pass@db:5432/decome_test"

# NullPool: every checkout creates a fresh connection and closes it on return.
# This prevents asyncpg connections (which are event-loop-bound) from being
# accidentally reused across the session-scoped setup_db and function-scoped
# per-test fixtures, which run in different event loops.
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db():
    # Ensure test database exists
    admin_engine = create_async_engine(
        "postgresql+asyncpg://decome:decome_dev_pass@db:5432/decome",
        echo=False,
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    async with admin_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname='decome_test'")
        )
        if not result.scalar():
            await conn.execute(text("CREATE DATABASE decome_test"))
    await admin_engine.dispose()

    # Create schema in test db
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Seed roles
    async with TestSession() as session:
        from sqlalchemy import select
        for role_name in ("admin", "bdm", "director"):
            result = await session.execute(select(Role).where(Role.name == role_name))
            if not result.scalar_one_or_none():
                session.add(Role(name=role_name, description=role_name))
        await session.commit()

    # Seed programs (default N/A)
    async with TestSession() as session:
        from sqlalchemy import select
        from app.models.program import Program
        result = await session.execute(select(Program).where(Program.name == "N/A"))
        if not result.scalar_one_or_none():
            session.add(Program(name="N/A", is_default=True, is_active=True))
        await session.commit()

    # Seed reminder types
    async with TestSession() as session:
        from sqlalchemy import select
        from app.models.reminder_type import ReminderType
        reminder_types = [
            ("Follow-up Call", "#FF6B6B"),
            ("Payment Review", "#4ECDC4"),
            ("Contract Renewal", "#FFE66D"),
            ("Courtesy Visit", "#95E1D3"),
            ("Other", "#C7CEEA"),
        ]
        for name, color in reminder_types:
            result = await session.execute(select(ReminderType).where(ReminderType.name == name))
            if not result.scalar_one_or_none():
                session.add(ReminderType(name=name, color=color, is_active=True))
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _create_role(db: AsyncSession, name: str) -> Role:
    from sqlalchemy import select
    result = await db.execute(select(Role).where(Role.name == name))
    role = result.scalar_one_or_none()
    if not role:
        role = Role(name=name, description=name)
        db.add(role)
        await db.commit()
        await db.refresh(role)
    return role


async def _create_user(db: AsyncSession, email: str, role_name: str, password: str = "Test123!") -> User:
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    role = await _create_role(db, role_name)
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=f"Test {role_name.capitalize()}",
        role_id=role.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db: AsyncSession) -> User:
    return await _create_user(db, "admin_test@test.example", "admin")


@pytest_asyncio.fixture
async def bdm_user(db: AsyncSession) -> User:
    return await _create_user(db, "bdm_test@test.example", "bdm")


@pytest_asyncio.fixture
async def director_user(db: AsyncSession) -> User:
    return await _create_user(db, "director_test@test.example", "director")


async def _get_token(client: AsyncClient, email: str, password: str = "Test123!") -> str:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient, admin_user: User) -> str:
    return await _get_token(client, admin_user.email)


@pytest_asyncio.fixture
async def bdm_token(client: AsyncClient, bdm_user: User) -> str:
    return await _get_token(client, bdm_user.email)


@pytest_asyncio.fixture
async def director_token(client: AsyncClient, director_user: User) -> str:
    return await _get_token(client, director_user.email)
