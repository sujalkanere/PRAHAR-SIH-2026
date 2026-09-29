"""Database engines and session factories.

Async engine (asyncpg) is used by the FastAPI request path.
A synchronous engine (psycopg2) is used by the detection pipeline,
scripts and Alembic migrations (heavy compute runs in worker threads).
Supports both local SQLite and hosted PostgreSQL/Supabase out of the box.
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    pass


import os
import tempfile
from pathlib import Path


def _sanitize_sqlite_url(url: str) -> str:
    if "sqlite" not in url:
        return url
    # On non-Windows (e.g. Linux / Vercel), if the URL contains Windows paths or relative paths into read-only dirs,
    # redirect to /tmp/mplads.db
    is_unix_or_cloud = (os.name != "nt") or bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("VERCEL_ENV"))
    if is_unix_or_cloud:
        url_lower = url.lower()
        if "c:" in url_lower or "users" in url_lower or "\\ " in url or "/data/" in url or "backend" in url_lower:
            tmp_db = Path(tempfile.gettempdir()) / "mplads.db"
            prefix = "sqlite+aiosqlite:///" if "+aiosqlite" in url else "sqlite:///"
            return f"{prefix}{tmp_db.as_posix()}"
    return url


def _normalize_async_url(raw_url: str) -> str:
    url = _sanitize_sqlite_url((raw_url or "").strip())
    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    # asyncpg expects ssl= rather than sslmode=
    if "sslmode=" in url:
        url = url.replace("sslmode=", "ssl=")
    if "supabase" in url and "ssl=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}ssl=require"
    return url


def _normalize_sync_url(raw_url: str, fallback_async_url: str = "") -> str:
    url = _sanitize_sqlite_url((raw_url or "").strip())
    # If sync url is unconfigured or defaulting to localhost/sqlite while async points to cloud (e.g. Supabase)
    if not url or (("localhost" in url or "sqlite" in url) and ("postgres" in fallback_async_url and "localhost" not in fallback_async_url)):
        url = fallback_async_url.strip()
    if url.startswith("postgresql+asyncpg://"):
        url = "postgresql://" + url[len("postgresql+asyncpg://"):]
    elif url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    # psycopg2 expects sslmode= rather than ssl=
    if "ssl=" in url and "sslmode=" not in url:
        url = url.replace("ssl=", "sslmode=")
    if "supabase" in url and "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


ASYNC_DB_URL = _normalize_async_url(settings.database_url)
SYNC_DB_URL = _normalize_sync_url(settings.sync_database_url, settings.database_url)

is_sqlite_async = "sqlite" in ASYNC_DB_URL
is_sqlite_sync = "sqlite" in SYNC_DB_URL

if is_sqlite_async:
    try:
        raw_p = ASYNC_DB_URL.split(":///")[-1].split("?")[0]
        if raw_p and not raw_p.startswith(":memory:"):
            if not raw_p.startswith("/") and os.name != "nt":
                raw_p = "/" + raw_p
            p = Path(raw_p)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.touch(exist_ok=True)
    except Exception as _e:
        print(f"[database] notice touching sqlite path: {_e}")

connect_args_async = {"timeout": 60} if is_sqlite_async else {"statement_cache_size": 0}

async_engine = create_async_engine(
    ASYNC_DB_URL,
    echo=False,
    connect_args=connect_args_async,
    **({} if is_sqlite_async else {"pool_size": 10, "pool_pre_ping": True, "pool_recycle": 300})
)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(
    SYNC_DB_URL,
    echo=False,
    connect_args={"timeout": 60} if is_sqlite_sync else {},
    **({} if is_sqlite_sync else {"pool_size": 5, "pool_pre_ping": True, "pool_recycle": 300})
)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)

if is_sqlite_sync:
    @event.listens_for(sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=DELETE")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=60000")
            cursor.close()
        except Exception:
            pass


_tables_initialized = False


async def ensure_db_initialized() -> None:
    global _tables_initialized
    if not _tables_initialized:
        await init_db()
        try:
            from app.scripts_helpers import seed_users
            await seed_users()
        except Exception as e:
            print(f"[ensure_db_initialized] seed notice: {e}")
        _tables_initialized = True


async def get_db():
    """FastAPI dependency yielding an async session."""
    if not _tables_initialized:
        try:
            await ensure_db_initialized()
        except Exception as e:
            print(f"[get_db] ensure_db_initialized notice: {e}")
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
    """Create all tables (idempotent). Automatically initializes pgvector extension on PostgreSQL/Supabase."""
    from app import models  # noqa: F401  ensure models are registered

    async with async_engine.begin() as conn:
        if not is_sqlite_async:
            try:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            except Exception as e:
                print(f"[init_db] vector extension notice: {e}")
        await conn.run_sync(Base.metadata.create_all)


def init_db_sync() -> None:
    from app import models  # noqa: F401

    if not is_sqlite_sync:
        try:
            with sync_engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.commit()
        except Exception as e:
            print(f"[init_db_sync] vector extension notice: {e}")

    Base.metadata.create_all(sync_engine)
