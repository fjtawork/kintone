import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text
import os
from pathlib import Path
from dotenv import load_dotenv

from app.main import app
from app.core.database import get_db
from app.core.config import settings

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Create a test engine instance.
# IMPORTANT: In a real scenario with pytest-asyncio, we should create the engine
# INSIDE a fixture so it's bound to the correct event loop.

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Fixture to provide a database session that overrides the dependency.
    This creates a NEW engine per test (or per session if scoped) to avoid loop binding issues.
    """
    test_database_url = os.getenv("TEST_DATABASE_URL")
    if not test_database_url:
        raise RuntimeError("TEST_DATABASE_URL is required for running tests.")
    if test_database_url == settings.SQLALCHEMY_DATABASE_URI:
        raise RuntimeError("TEST_DATABASE_URL must be different from development database URL.")

    engine = create_async_engine(test_database_url)
    TestingSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with TestingSessionLocal() as session:
        # Keep tests isolated: remove mutable data before each test.
        await session.execute(
            text(
                """
                TRUNCATE TABLE
                    records,
                    fields,
                    apps,
                    users,
                    departments,
                    job_titles
                CASCADE
                """
            )
        )
        await session.commit()
        yield session
        # Cleanup
    
    await engine.dispose()

@pytest.fixture
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """
    Client fixture that uses the overridden db dependency.
    """
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
        
    app.dependency_overrides = {}
