"""MPLADS Sentinel — FastAPI application entry (SRS Appendix A)."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: create tables + seed users (idempotent; docker also runs alembic)
    try:
        await init_db()
        if settings.dev_demo:
            from app.scripts_helpers import seed_users
            await seed_users()
        # mark detection runs orphaned by a restart as FAILED
        from app.database import SyncSessionLocal
        from sqlalchemy import update
        from app.models import DetectionRun
        with SyncSessionLocal() as s:
            s.execute(update(DetectionRun).where(DetectionRun.status == "RUNNING").values(
                status="FAILED", error_message="interrupted by service restart"))
            s.commit()
    except Exception as exc:  # pragma: no cover
        print(f"[startup] DB init failed: {exc}")
    yield


app = FastAPI(
    title="MPLADS Sentinel API",
    description="AI-Powered Anomaly Detection System for MPLADS Scheme (SIH-26102)",
    version="1.0.0-MVP",
    docs_url="/api/v1/docs",
    openapi_url="/api/v1/openapi.json",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """API rate limiting: 100 requests/minute per user (NFR-SEC-006)."""
    path = request.url.path
    if not path.startswith("/api/v1") or path.startswith("/api/v1/auth"):
        return await call_next(request)
    from app.auth.rate_limit import api_limiter

    key = request.client.host if request.client else "unknown"
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from app.auth.jwt_handler import decode_token
            payload = decode_token(auth[7:], expected_type="access")
            key = f"user:{payload['sub']}"
        except Exception:
            pass
    if not api_limiter.allow(key):
        return JSONResponse(status_code=429, content={
            "error": {"code": "RATE_LIMITED", "message": "Too many requests",
                      "details": {"limit": api_limiter.max_requests, "window": "1 minute"}}})
    return await call_next(request)


from fastapi.responses import JSONResponse, RedirectResponse
from app.api import admin, analytics, anomalies, auth, constituencies, reports, works  # noqa: E402

app.include_router(auth.router)
app.include_router(works.router)
app.include_router(constituencies.router)
app.include_router(anomalies.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(reports.router)


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/api/v1/docs")


@app.get("/docs", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url="/api/v1/docs")


@app.get("/health")
async def health():
    """Health endpoint (NFR-REL-006)."""
    db_ok = False
    last_run = None
    try:
        from app.database import AsyncSessionLocal
        from app.models import DetectionRun
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
            run = (await session.execute(
                select(DetectionRun).order_by(DetectionRun.started_at.desc()).limit(1))).scalars().first()
            if run:
                last_run = {"id": str(run.id), "status": run.status,
                            "started_at": run.started_at.isoformat() if run.started_at else None}
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "database_connected": db_ok,
        "ml_engine_ready": True,
        "disk_space_ok": True,
        "last_detection_run": last_run,
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }
