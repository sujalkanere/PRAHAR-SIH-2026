"""Fund utilization anomaly detection (FR-ADE-004).

method_1: thresholds — <30% HIGH LOW_UTILIZATION, <50% MEDIUM, >110% OVER_UTILIZATION.
method_2: z-score vs state peers (|z| > 2.0) — FUND_UTILIZATION_ANOMALY.
method_3: year-over-year shift > 40 pp — SUDDEN_UTILIZATION_SHIFT.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Constituency, FundRelease, Work

ANOMALY_TYPES = ("LOW_UTILIZATION", "OVER_UTILIZATION", "SUDDEN_UTILIZATION_SHIFT", "FUND_UTILIZATION_ANOMALY")


def compute_utilization(session: Session) -> dict[tuple[str, str], dict]:
    """Returns {(constituency_id, fy): {released, expenditure, rate}}."""
    result: dict[tuple[str, str], dict] = {}

    releases = session.execute(select(FundRelease)).scalars().all()
    for r in releases:
        key = (str(r.constituency_id), r.financial_year)
        entry = result.setdefault(key, {"released": 0.0, "expenditure": 0.0, "rate": None})
        entry["released"] += float(r.amount_released or 0)

    works = session.execute(select(Work)).scalars().all()
    for w in works:
        key = (str(w.constituency_id), w.financial_year)
        entry = result.setdefault(key, {"released": 0.0, "expenditure": 0.0, "rate": None})
        entry["expenditure"] += float(w.actual_expenditure or 0)

    for key, entry in result.items():
        if entry["released"] > 0:
            entry["rate"] = entry["expenditure"] / entry["released"] * 100.0
    return result


def detect_fund_utilization(session: Session, reference_date=None) -> int:
    util = compute_utilization(session)
    now = datetime.now(timezone.utc)

    # constituency metadata
    consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}

    # state stats for z-score
    state_rates: dict[str, list[float]] = {}
    for (cid, fy), entry in util.items():
        if entry["rate"] is None:
            continue
        state = consts[cid].state
        state_rates.setdefault(state, []).append(entry["rate"])
    state_stats = {}
    for state, rates in state_rates.items():
        arr = np.array(rates, dtype=float)
        mu, sd = float(arr.mean()), float(arr.std())
        state_stats[state] = (mu, sd if sd > 1e-9 else 0.0)

    created = 0
    for (cid, fy), entry in sorted(util.items()):
        rate = entry["rate"]
        if rate is None:
            continue
        const = consts[cid]
        details_base = {
            "fund_utilization_rate": round(rate, 2),
            "total_funds_released": round(entry["released"], 2),
            "total_expenditure": round(entry["expenditure"], 2),
            "constituency": const.name, "financial_year": fy,
        }

        # method 1: thresholds
        if rate < 30.0:
            session.add(Anomaly(
                id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                anomaly_type="LOW_UTILIZATION", severity="HIGH", confidence_score=0.98,
                detection_method="THRESHOLD", details=details_base, status="NEW", detected_at=now))
            created += 1
        elif rate < 50.0:
            session.add(Anomaly(
                id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                anomaly_type="LOW_UTILIZATION", severity="MEDIUM", confidence_score=0.95,
                detection_method="THRESHOLD", details=details_base, status="NEW", detected_at=now))
            created += 1
        if rate > 110.0:
            session.add(Anomaly(
                id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                anomaly_type="OVER_UTILIZATION", severity="HIGH", confidence_score=0.98,
                detection_method="THRESHOLD", details=details_base, status="NEW", detected_at=now))
            created += 1

        # method 2: z-score vs state
        mu, sd = state_stats.get(const.state, (0.0, 0.0))
        if sd > 1e-9:
            z = (rate - mu) / sd
            if abs(z) > 2.0:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="FUND_UTILIZATION_ANOMALY",
                    severity="HIGH" if abs(z) > 3.0 else "MEDIUM", confidence_score=0.9,
                    detection_method="ZSCORE",
                    details={**details_base, "state_average_rate": round(mu, 2), "z_score": round(z, 4)},
                    status="NEW", detected_at=now))
                created += 1

        # method 3: year-over-year shift
        prev_key = (cid, _prev_fy(fy))
        if prev_key in util and util[prev_key]["rate"] is not None and util[prev_key]["rate"] > 0:
            change = rate - util[prev_key]["rate"]
            if abs(change) > 40.0:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="SUDDEN_UTILIZATION_SHIFT",
                    severity="HIGH" if change < 0 else "MEDIUM", confidence_score=0.92,
                    detection_method="TEMPORAL",
                    details={**details_base, "previous_year_rate": round(util[prev_key]["rate"], 2),
                             "change_pp": round(change, 2)},
                    status="NEW", detected_at=now))
                created += 1

    session.commit()
    return created


def _prev_fy(fy: str) -> str:
    y = int(fy[:4]) - 1
    return f"{y}-{str((y + 1) % 100).zfill(2)}"


def clear_fund_utilization(session: Session) -> None:
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type.in_(ANOMALY_TYPES)))
    session.commit()
