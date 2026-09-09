"""Anomaly detection pipeline orchestrator (SRS 6.1 Phase 2).

Runs all detectors in sequence (idempotent per run), then risk scoring.
Called from the worker thread (or Celery in Docker).
"""
from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select

from app.config import get_settings
from app.database import SyncSessionLocal
from app.models import Anomaly, Constituency, DetectionRun, Work

from .compliance_detection import clear_compliance_risk, detect_compliance_risk
from .cost_overrun import clear_cost_overrun, detect_cost_overrun
from .delay_detection import clear_delays, detect_delays
from .duplicate_detection import clear_duplicates, detect_duplicates
from .durability_detection import clear_durability_risk, detect_durability_risk
from .fund_utilization import clear_fund_utilization, detect_fund_utilization
from .pattern_detection import clear_patterns, detect_patterns
from .payment_detection import clear_payment_risk, detect_payment_risk


def reference_date() -> date:
    cfg = get_settings()
    if cfg.reference_date:
        return date.fromisoformat(cfg.reference_date)
    return date.today()


def run_detection_pipeline(
    triggered_by: str | None = None,
    trigger_type: str = "MANUAL",
    run_id: str | uuid.UUID | None = None,
) -> dict:
    """Synchronous pipeline execution (worker thread)."""
    from app.services.risk_scoring import run_risk_scoring

    settings = get_settings()
    started = datetime.now(timezone.utc)
    session = SyncSessionLocal()
    triggered_uid = None
    if triggered_by:
        try:
            triggered_uid = uuid.UUID(str(triggered_by))
        except (ValueError, TypeError):
            triggered_uid = None

    run_uid = None
    if run_id:
        try:
            run_uid = uuid.UUID(str(run_id)) if not isinstance(run_id, uuid.UUID) else run_id
        except (ValueError, TypeError):
            run_uid = None

    try:
        if run_uid:
            existing_run = session.get(DetectionRun, run_uid)
            if not existing_run:
                session.add(DetectionRun(id=run_uid, triggered_by=triggered_uid, trigger_type=trigger_type,
                                         status="RUNNING", started_at=started))
                session.commit()
        else:
            run_uid = uuid.uuid4()
            session.add(DetectionRun(id=run_uid, triggered_by=triggered_uid, trigger_type=trigger_type,
                                     status="RUNNING", started_at=started))
            session.commit()
        t0 = time.time()
        ref = reference_date()

        # clear previous detections (idempotent re-runs across all detectors)
        for clear in (clear_cost_overrun, clear_delays, clear_duplicates,
                      clear_fund_utilization, clear_patterns, clear_payment_risk,
                      clear_compliance_risk, clear_durability_risk):
            clear(session)

        counts = {
            "COST_OVERRUN": detect_cost_overrun(session, ref),
            "DELAYED/STALLED": detect_delays(session, ref),
            "DUPLICATE_WORK": detect_duplicates(session, ref),
            "PAYMENT_RISK": detect_payment_risk(session, ref),
            "COMPLIANCE_RISK": detect_compliance_risk(session, ref),
            "DURABILITY_RISK": detect_durability_risk(session, ref),
            "FUND_UTILIZATION": detect_fund_utilization(session, ref),
            "PATTERNS": detect_patterns(session, ref),
        }
        works_analyzed = session.execute(select(func.count(Work.id))).scalar() or 0
        run_risk_scoring(session)

        total = session.execute(
            select(func.count(Anomaly.id)).where(Anomaly.status == "NEW")).scalar() or 0

        run = session.get(DetectionRun, run_uid)
        if run:
            run.status = "COMPLETED"
            run.anomalies_detected = total
            run.works_analyzed = works_analyzed
            run.completed_at = datetime.now(timezone.utc)
            session.commit()
        return {
            "run_id": str(run_uid), "status": "COMPLETED", "anomalies_detected": total,
            "works_analyzed": works_analyzed, "detector_counts": counts,
            "duration_seconds": round(time.time() - t0, 2),
        }
    except Exception as exc:  # pragma: no cover - failure path
        session.rollback()
        run = session.get(DetectionRun, run_uid)
        if run:
            run.status = "FAILED"
            run.error_message = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            session.commit()
        raise
    finally:
        session.close()
