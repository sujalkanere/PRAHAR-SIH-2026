"""Shared pytest fixtures — isolated test database + API client."""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile

import pytest

# Check if PostgreSQL test DB is reachable; fallback to SQLite if offline
pg_ok = False
try:
    import psycopg2
    conn = psycopg2.connect("postgresql://mplads:mplads_secure_password@localhost:5432/mplads_sentinel_test", connect_timeout=1)
    conn.close()
    pg_ok = True
except Exception:
    pg_ok = False

if pg_ok:
    os.environ["DATABASE_URL"] = (
        "postgresql+asyncpg://mplads:mplads_secure_password@localhost:5432/mplads_sentinel_test"
    )
    os.environ["SYNC_DATABASE_URL"] = (
        "postgresql://mplads:mplads_secure_password@localhost:5432/mplads_sentinel_test"
    )
else:
    test_db_path = os.path.join(tempfile.gettempdir(), "mplads_sentinel_test.db").replace("\\", "/")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{test_db_path}"
    os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{test_db_path}"

os.environ["LOGIN_RATE_LIMIT"] = "100000"
os.environ["API_RATE_LIMIT"] = "100000"
os.environ["REPORT_DIR"] = os.path.join(tempfile.gettempdir(), "mplads_test_reports").replace("\\", "/")
os.environ["DATA_DIR"] = os.path.join(tempfile.gettempdir(), "mplads_test_data").replace("\\", "/")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings  # noqa: E402
get_settings.cache_clear()

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.database import AsyncSessionLocal, SyncSessionLocal, init_db_sync, sync_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    Anomaly,
    AuditLog,
    Constituency,
    ConstituencyRiskScore,
    DetectionRun,
    DuplicatePair,
    FundRelease,
    RefreshToken,
    UploadHistory,
    User,
    Work,
)
from app.scripts_helpers import seed_users  # noqa: E402
from app.auth.rate_limit import api_limiter, login_limiter  # noqa: E402
from sqlalchemy import delete  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _database():
    """Create the test schema once per session."""
    init_db_sync()
    yield
    sync_engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_db(_database):
    """Empty all tables (keep schema) between tests; reseed users."""
    api_limiter.reset()
    login_limiter.reset()
    with SyncSessionLocal() as s:
        for model in (AuditLog, RefreshToken, UploadHistory, DuplicatePair, Anomaly,
                      ConstituencyRiskScore, FundRelease, Work, Constituency, DetectionRun, User):
            s.execute(delete(model))
        s.commit()
    await seed_users()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def sync_session():
    s = SyncSessionLocal()
    yield s
    s.close()


@pytest.fixture
def login(client):
    """Returns an async helper: await login(client, user, password) -> headers."""

    async def _login(username: str, password: str):
        r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _login
