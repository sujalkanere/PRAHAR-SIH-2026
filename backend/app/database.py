"""Database engines and session factories.

Async engine (asyncpg) is used by the FastAPI request path.
A synchronous engine (psycopg2) is used by the detection pipeline,
scripts and Alembic migrations (heavy compute runs in worker threads).
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    pass


is_sqlite_async = "sqlite" in settings.database_url
is_sqlite_sync = "sqlite" in settings.sync_database_url

async_engine = create_async_engine(
    settings.database_url,
    echo=False,
    **({} if is_sqlite_async else {"pool_size": 10})
)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(
    settings.sync_database_url,
    echo=False,
    **({} if is_sqlite_sync else {"pool_size": 5})
)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)


async def get_db():
    """FastAPI dependency yielding an async session."""
    async with AsyncSessionLocal() as session:
        yield session


def get_sync_db():
    """Context manager style sync session (pipeline / scripts)."""
    session = SyncSessionLocal()
    try:
        return session
    except Exception:
        session.close()
        raise


async def init_db() -> None:
    """Create all tables (idempotent). Docker path also runs alembic upgrade head."""
    from app import models  # noqa: F401  ensure models are registered

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def init_db_sync() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(sync_engine)
