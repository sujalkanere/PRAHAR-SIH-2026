"""Admin endpoints (FR-DIM-001/002, FR-API-001 admin)."""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import ROLE_ADMIN, require_roles
from app.config import get_settings
from app.database import get_db
from app.models import DetectionRun, UploadHistory, User
from app.schemas import DetectionRunOut, SyntheticRequest, UploadResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

settings = get_settings()


_PIPELINE_LOCK = threading.Lock()


def _run_sync_pipeline(triggered_by: str | None, trigger_type: str) -> dict:
    """Runs the detection pipeline in a worker thread (serialized globally)."""
    from app.services.anomaly_detection.pipeline import run_detection_pipeline
    with _PIPELINE_LOCK:
        return run_detection_pipeline(triggered_by=triggered_by, trigger_type=trigger_type)


@router.post("/upload", response_model=UploadResponse)
async def upload_data(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    content = await file.read()
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail={
            "code": "VALIDATION_ERROR", "message": "file size exceeds limit"})

    from app.services.data_ingestion import ingest_upload
    from app.utils.audit import write_audit

    result = await ingest_upload(db, filename=file.filename or "upload.csv",
                                 content=content, user=user)
    await write_audit(db, user_id=str(user.id), action="DATA_UPLOAD",
                      resource_type="upload", resource_id=result["upload_id"],
                      new_value={"filename": file.filename, "records_valid": result["records_valid"],
                                 "records_rejected": result["records_rejected"]},
                      ip_address=request.client.host if request.client else None,
                      user_agent=request.headers.get("user-agent"))
    if not result.get("ok"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={
            "code": "VALIDATION_ERROR", "message": "upload failed validation",
            "details": result["validation_errors"][:50]})

    trigger_type = "AUTO_POST_UPLOAD"
    background.add_task(_run_sync_pipeline, str(user.id), trigger_type)
    return UploadResponse(
        upload_id=result["upload_id"], records_parsed=result["records_parsed"],
        records_valid=result["records_valid"], records_rejected=result["records_rejected"],
        validation_errors=result["validation_errors"], ingestion_timestamp=result["ingestion_timestamp"],
        detection_triggered=True,
    )


@router.post("/generate-synthetic")
async def generate_synthetic(
    request: Request,
    background: BackgroundTasks,
    body: SyntheticRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    params = body or SyntheticRequest()
    from app.services.synthetic_generator import GeneratorParams, generate_synthetic

    dfs = generate_synthetic(GeneratorParams(
        num_constituencies=params.num_constituencies,
        num_works_per_constituency=params.num_works_per_constituency,
        anomaly_injection_rate=params.anomaly_injection_rate,
        seed=params.seed,
    ))
    counts = await _load_dfs_to_db(db, dfs)
    from app.utils.audit import write_audit
    await write_audit(db, user_id=str(user.id), action="SYNTHETIC_GENERATION",
                      resource_type="dataset",
                      new_value={"params": params.model_dump(), "counts": counts},
                      ip_address=request.client.host if request.client else None,
                      user_agent=request.headers.get("user-agent"))
    background.add_task(_run_sync_pipeline, str(user.id), "MANUAL")
    return {"message": f"{counts['works']} works generated", **counts, "params": params.model_dump()}


@router.post("/reset-database")
@router.post("/reset-all")
@router.post("/reset-default")
async def reset_database(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN)),
):
    """Completely resets and clears all works, fund releases, anomalies, detection runs, upload history, and risk scores, setting all metrics to zero."""
    from app.models import (
        Anomaly,
        Constituency,
        ConstituencyRiskScore,
        DetectionRun,
        DuplicatePair,
        FundRelease,
        UploadHistory,
        Work,
    )
    from app.utils.audit import write_audit

    await db.execute(DuplicatePair.__table__.delete())
    await db.execute(Anomaly.__table__.delete())
    await db.execute(ConstituencyRiskScore.__table__.delete())
    await db.execute(Work.__table__.delete())
    await db.execute(FundRelease.__table__.delete())
    await db.execute(DetectionRun.__table__.delete())
    await db.execute(UploadHistory.__table__.delete())
    await db.execute(Constituency.__table__.delete())
    await db.commit()

    await write_audit(
        db,
        user_id=str(user.id),
        action="RESET_DATABASE_TO_ZERO",
        resource_type="system",
        new_value={"status": "CLEARED_TO_ZERO"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return {
        "message": "Database completely reset to zero. All works, anomalies, releases, and metrics cleared.",
        "status": "CLEARED",
        "total_works": 0,
        "total_expenditure": 0,
        "anomalies_detected": 0,
    }


async def _load_dfs_to_db(db: AsyncSession, dfs: dict) -> dict:
    """Inserts synthetic dataframes into the DB (works + releases + labels stored as CSV)."""
    from app.models import Constituency, FundRelease, Work
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    import pandas as pd

    works_df: pd.DataFrame = dfs["works"]
    releases_df: pd.DataFrame = dfs["fund_releases"]

    # clear existing demo data (fresh dataset) — FK-safe order
    from app.models import Anomaly, ConstituencyRiskScore, DuplicatePair
    await db.execute(DuplicatePair.__table__.delete())
    await db.execute(Anomaly.__table__.delete())
    await db.execute(ConstituencyRiskScore.__table__.delete())
    await db.execute(Work.__table__.delete())
    await db.execute(FundRelease.__table__.delete())
    await db.execute(Constituency.__table__.delete())

    const_cache: dict[str, Constituency] = {}
    works_records = works_df.to_dict("records")
    for r in works_records:
        cname = r["constituency_name"]
        if cname not in const_cache:
            c = Constituency(id=uuid.uuid4(), name=cname, state=r["state_name"],
                             district=r["district_name"], mp_name=r["mp_name"])
            db.add(c)
            await db.flush()
            const_cache[cname] = c

    works_to_add = []
    for r in works_records:
        c = const_cache[r["constituency_name"]]
        overrun = 0.0
        if float(r["sanctioned_amount"]) > 0:
            overrun = round((float(r["actual_expenditure"] or 0) - float(r["sanctioned_amount"]))
                            / float(r["sanctioned_amount"]) * 100, 2)
        works_to_add.append(Work(
            id=uuid.uuid4(), work_id=r["work_id"], constituency_id=c.id,
            work_description=r["work_description"], work_category=r["work_category"],
            sanctioned_amount=float(r["sanctioned_amount"]),
            actual_expenditure=float(r["actual_expenditure"] or 0),
            cost_overrun_percentage=overrun,
            sanction_date=__to_date(r["sanction_date"]),
            expected_completion_date=__to_date(r["expected_completion_date"]) if r.get("expected_completion_date") else None,
            completion_date=__to_date(r["completion_date"]) if r.get("completion_date") else None,
            work_status=r["work_status"], implementing_agency=r["implementing_agency"],
            financial_year=r["financial_year"],
            latitude=float(r["latitude"]) if r.get("latitude") else None,
            longitude=float(r["longitude"]) if r.get("longitude") else None,
        ))
    db.add_all(works_to_add)

    releases_to_add = []
    for r in releases_df.to_dict("records"):
        c = const_cache[r["constituency_name"]]
        releases_to_add.append(FundRelease(
            id=uuid.uuid4(), release_id=r["release_id"], constituency_id=c.id,
            financial_year=r["financial_year"], installment_number=int(r["installment_number"]),
            amount_released=float(r["amount_released"]),
            release_date=__to_date(r["release_date"]),
            cumulative_release=float(r.get("cumulative_release") or 0),
        ))
    db.add_all(releases_to_add)

    # persist labels csv for the validation script
    import os
    labels_df = dfs["anomaly_labels"]
    os.makedirs(settings.data_dir, exist_ok=True)
    labels_df.to_csv(f"{settings.data_dir}/synthetic_anomaly_labels.csv", index=False)
    works_df.to_csv(f"{settings.data_dir}/synthetic_sanctioned_works.csv", index=False)
    releases_df.to_csv(f"{settings.data_dir}/synthetic_fund_releases.csv", index=False)

    await db.commit()
    return {"works": len(works_df), "fund_releases": len(releases_df),
            "anomalies_injected": len(labels_df)}


def __to_date(v):
    from datetime import date as _date
    if isinstance(v, _date):
        return v
    if v is None or str(v).strip() == "":
        return None
    return _date.fromisoformat(str(v)[:10])


@router.post("/run-detection", response_model=DetectionRunOut)
async def run_detection(background: BackgroundTasks,
                        db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_roles(ROLE_ADMIN))):
    running = (await db.execute(
        select(DetectionRun).where(DetectionRun.status == "RUNNING").limit(1))).scalars().first()
    if running is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
            "code": "DETECTION_RUNNING",
            "message": "a detection run is already in progress",
            "run_id": str(running.id),
        })
    run = DetectionRun(id=uuid.uuid4(), triggered_by=user.id, trigger_type="MANUAL",
                       status="RUNNING", started_at=datetime.now(timezone.utc))
    db.add(run)
    await db.commit()
    background.add_task(_run_sync_pipeline, str(user.id), "MANUAL")
    return DetectionRunOut(id=str(run.id), status="RUNNING", anomalies_detected=0, works_analyzed=0,
                           started_at=run.started_at)


@router.get("/detection-runs")
async def detection_runs(db: AsyncSession = Depends(get_db),
                         user: User = Depends(require_roles(ROLE_ADMIN))):
    rows = (await db.execute(
        select(DetectionRun).order_by(DetectionRun.started_at.desc()).limit(20))).scalars().all()
    return {"data": [DetectionRunOut(
        id=str(r.id), status=r.status, anomalies_detected=r.anomalies_detected or 0,
        works_analyzed=r.works_analyzed or 0, started_at=r.started_at,
        completed_at=r.completed_at, error_message=r.error_message).model_dump() for r in rows]}


@router.get("/detection-runs/{run_id}", response_model=DetectionRunOut)
async def detection_run_detail(run_id: str, db: AsyncSession = Depends(get_db),
                               user: User = Depends(require_roles(ROLE_ADMIN))):
    run = (await db.execute(select(DetectionRun).where(DetectionRun.id == run_id))).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={
            "code": "NOT_FOUND", "message": "detection run not found"})
    return DetectionRunOut(
        id=str(run.id), status=run.status, anomalies_detected=run.anomalies_detected or 0,
        works_analyzed=run.works_analyzed or 0, started_at=run.started_at,
        completed_at=run.completed_at, error_message=run.error_message)


@router.get("/upload-history")
@router.get("/uploads")
async def upload_history(db: AsyncSession = Depends(get_db),
                         user: User = Depends(require_roles(ROLE_ADMIN))):
    rows = (await db.execute(select(UploadHistory).order_by(UploadHistory.uploaded_at.desc()).limit(20))).scalars().all()
    return {"data": [{
        "id": str(r.id), "filename": r.filename, "file_hash": r.file_hash,
        "file_size_bytes": r.file_size_bytes, "records_total": r.records_total,
        "records_valid": r.records_valid, "records_rejected": r.records_rejected,
        "validation_errors": r.validation_errors or [], "status": r.status,
        "uploaded_at": r.uploaded_at.isoformat(),
    } for r in rows]}
