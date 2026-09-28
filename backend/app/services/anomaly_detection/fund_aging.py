"""Unspent fund aging detector (Q1.6).

Tracks money sanctioned/released but sitting unspent or stalled for extended periods:
- > 180 days idle: AGING_MEDIUM
- > 365 days idle: AGING_HIGH
- > 730 days idle: AGING_CRITICAL

Distinct from fund_utilization (rate vs elapsed time).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Expenditure, Work


def clear_fund_aging(session: Session) -> None:
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type == "FUND_AGING"))
    session.flush()


def detect_fund_aging(session: Session, reference_date: date | None = None) -> int:
    """Flags stalled/unspent projects exceeding 180, 365, and 730 day idle thresholds."""
    if reference_date is None:
        from app.services.anomaly_detection.pipeline import reference_date as get_ref_date
        reference_date = get_ref_date()

    # Pre-fetch latest expenditure dates per work
    last_exp_rows = session.execute(
        select(
            Expenditure.work_id,
            func.max(Expenditure.expenditure_date).label("last_exp_date"),
        )
        .where(Expenditure.work_id.isnot(None), Expenditure.expenditure_date.isnot(None))
        .group_by(Expenditure.work_id)
    ).all()
    work_last_exp = {wid: exp_d for wid, exp_d in last_exp_rows if wid}

    active_works = session.execute(
        select(Work).where(Work.work_status.in_(("SANCTIONED", "IN_PROGRESS")))
    ).scalars().all()

    now = datetime.now(timezone.utc)
    anomalies_created = 0

    for w in active_works:
        sanc_d = w.sanction_date
        if not sanc_d:
            continue

        act_exp = float(w.actual_expenditure or 0)
        last_d = work_last_exp.get(w.id)

        if act_exp == 0 or last_d is None:
            days_idle = (reference_date - sanc_d).days
        else:
            days_idle = (reference_date - last_d).days

        if days_idle <= 180:
            continue

        if days_idle > 730:
            severity = "CRITICAL"
            score_contrib = 100
        elif days_idle > 365:
            severity = "HIGH"
            score_contrib = 75
        else:
            severity = "MEDIUM"
            score_contrib = 40

        # Update work's risk_components with dedicated aging_risk
        comps = dict(w.risk_components or {})
        comps["aging_risk"] = score_contrib
        comps["days_idle"] = days_idle
        w.risk_components = comps

        note = (
            f"Unspent fund aging: Work has been idle for {days_idle} days without expenditure progress "
            f"(Sanctioned: {sanc_d}, Spent: ₹{act_exp:,.2f})."
        )

        session.add(
            Anomaly(
                id=uuid.uuid4(),
                work_id=w.id,
                constituency_id=w.constituency_id,
                anomaly_type="FUND_AGING",
                severity=severity,
                confidence_score=0.95,
                detection_method="THRESHOLD",
                details={
                    "work_id": w.work_id,
                    "work_description": w.work_description[:120],
                    "work_category": w.work_category,
                    "days_idle": days_idle,
                    "sanction_date": sanc_d.isoformat(),
                    "sanctioned_amount": float(w.sanctioned_amount or 0),
                    "actual_expenditure": act_exp,
                    "work_status": w.work_status,
                },
                status="NEW",
                note=note,
                detected_at=now,
            )
        )
        anomalies_created += 1

    session.flush()
    return anomalies_created
