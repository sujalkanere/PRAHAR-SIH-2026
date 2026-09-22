"""Report endpoints (FR-DVZ-004) with high-performance query execution and TTL caching."""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import (
    ROLE_ADMIN, ROLE_DISTRICT, ROLE_MINISTRY, ROLE_MP, ROLE_STATE_NODAL,
    get_optional_current_user,
)
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import ReportRequest, ReportResponse
from app.utils.audit import write_audit

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
settings = get_settings()

REPORT_ROLES = (ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)

# File registries & cache
_report_registry: dict[str, str] = {}  # report_id -> file path
_report_cache: dict[str, tuple[str, float]] = {}  # cache_key -> (file_path, timestamp)
CACHE_TTL_SECONDS = 300  # 5-minute cache for identical report scopes


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    body: ReportRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    """Generates an executive audit report (PDF or CSV) with TTL caching."""
    # Scope check for authenticated users
    if user:
        if user.role in (ROLE_STATE_NODAL,) and body.scope == "STATE" and body.scope_id != user.scope_value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
                "code": "FORBIDDEN", "message": "Report scope outside your state"})
        if user.role in (ROLE_DISTRICT, ROLE_MP) and body.scope == "CONSTITUENCY" \
                and body.scope_id not in (user.scope_value, None) and body.scope_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
                "code": "FORBIDDEN", "message": "Report scope outside your area"})

    # Check cache first (instant response for repeat queries)
    cache_key = f"{body.scope}:{body.scope_id}:{body.financial_year}:{body.format}"
    cached = _report_cache.get(cache_key)
    now = time.time()
    if cached and (now - cached[1] < CACHE_TTL_SECONDS) and os.path.exists(cached[0]):
        cached_path = cached[0]
        report_id = str(uuid.uuid4())
        _report_registry[report_id] = cached_path
        return ReportResponse(report_id=report_id, download_url=f"/api/v1/reports/{report_id}/download")

    os.makedirs(settings.report_dir, exist_ok=True)
    report_id = str(uuid.uuid4())
    ext = "csv" if body.format == "CSV" else "pdf"
    path = os.path.join(settings.report_dir, f"{report_id}.{ext}")

    if body.format == "CSV":
        from app.services.report_generator import generate_csv_report
        content = await generate_csv_report(db, body.scope, body.scope_id, body.financial_year)
    else:
        from app.services.report_generator import generate_pdf_report
        content = await generate_pdf_report(db, body.scope, body.scope_id, body.financial_year)

    with open(path, "wb") as f:
        f.write(content)

    _report_registry[report_id] = path
    _report_cache[cache_key] = (path, now)

    # Audit log
    await write_audit(
        db,
        user_id=str(user.id) if user else None,
        action="REPORT_GENERATED",
        resource_type="report",
        resource_id=report_id,
        new_value={
            "scope": body.scope,
            "scope_id": body.scope_id,
            "format": body.format,
            "financial_year": body.financial_year,
            "is_public": user is None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ReportResponse(report_id=report_id, download_url=f"/api/v1/reports/{report_id}/download")


@router.get("/csv")
async def export_csv(
    scope: str = "NATIONAL",
    scope_id: str | None = None,
    financial_year: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    from app.services.report_generator import generate_csv_report
    content = await generate_csv_report(db, scope, scope_id, financial_year)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mplads_audit_report.csv"},
    )


@router.get("/pdf")
async def export_pdf(
    scope: str = "NATIONAL",
    scope_id: str | None = None,
    financial_year: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    from app.services.report_generator import generate_pdf_report
    content = await generate_pdf_report(db, scope, scope_id, financial_year)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=mplads_audit_report.pdf"},
    )


@router.get("/{report_id}/download")
async def download_report(
    report_id: str,
    user: User | None = Depends(get_optional_current_user),
):
    path = _report_registry.get(report_id)
    if path is None or not os.path.exists(path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Report not found or expired (24h retention)"},
        )
    return FileResponse(path, filename=os.path.basename(path))
