"""Application configuration (SRS 5.2 - environment variables)."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


import os
import sys

_IS_CLOUD = bool(
    os.getenv("VERCEL")
    or os.getenv("VERCEL_ENV")
    or os.getenv("NOW_REGION")
    or os.getenv("AWS_LAMBDA_FUNCTION_NAME")
    or os.getenv("LAMBDA_TASK_ROOT")
    or sys.platform.startswith("linux")
)
_DEFAULT_DB = "sqlite+aiosqlite:////tmp/mplads.db" if _IS_CLOUD else "sqlite+aiosqlite:///" + str(BASE_DIR / "data" / "mplads.db").replace("\\", "/")
_DEFAULT_SYNC_DB = "sqlite:////tmp/mplads.db" if _IS_CLOUD else "sqlite:///" + str(BASE_DIR / "data" / "mplads.db").replace("\\", "/")


class Settings(BaseSettings):
    environment: str = "production"
    log_level: str = "INFO"

    # Database (SRS 5.2 / Appendix B)
    database_url: str = _DEFAULT_DB
    sync_database_url: str = _DEFAULT_SYNC_DB
    redis_url: str = "redis://localhost:6379/0"

    # JWT (RS256)
    jwt_private_key_path: str = str(BASE_DIR / "keys" / "jwt_private.pem")
    jwt_public_key_path: str = str(BASE_DIR / "keys" / "jwt_public.pem")
    access_token_expiry_minutes: int = 30
    refresh_token_expiry_days: int = 7

    cors_origins: str = "http://localhost:5173,http://localhost:8000"

    # Ingestion limits (FR-DIM-001: 50 MB max file)
    max_upload_size_mb: int = 50

    # Storage dirs
    report_dir: str = str(BASE_DIR / "reports")
    data_dir: str = str(BASE_DIR / "data")
    model_dir: str = str(BASE_DIR / "models")
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Rate limits (NFR-SEC-006, FR-AAA-001)
    api_rate_limit: int = 100
    login_rate_limit: int = 5

    # Demo / Bootstrap flag (P0.5)
    dev_demo: bool = False

    # Feature flag for optional external AI explanation (Rule #4 - default OFF)
    external_explanation_enabled: bool = False

    # Analysis reference date; empty string -> today (FR-ADE-003)
    reference_date: str = ""

    class Config:
        env_file = str(BASE_DIR.parent / ".env")
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
