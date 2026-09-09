"""Cost overrun detection (FR-ADE-001).

method_1: threshold rule — overrun > 15% flagged, severity tiers.
method_2: z-score vs category peers (|z| > 2.5).
method_3: Isolation Forest on expenditure features (contamination 0.05,
          used to enrich confidence; an anomaly record is created when the
          threshold or z-score method fires).
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Work

ANOMALY_TYPE = "COST_OVERRUN"
THRESHOLD_PCT = 15.0
ZSCORE_LIMIT = 2.5


def _severity(overrun: float) -> str:
    if overrun > 50:
        return "CRITICAL"
    if overrun > 30:
        return "HIGH"
    return "MEDIUM"


def _confidence(overrun: float) -> float:
    return min(0.99, 0.7 + overrun / 400.0)


def detect_cost_overrun(session: Session, reference_date: date | None = None) -> int:
    works = list(session.execute(select(Work)).scalars().all())
    now = datetime.now(timezone.utc)

    # ---- method 3: Isolation Forest (enrichment) ----
    if_score: dict[str, float] = {}
    if len(works) >= 500:
        if_score = _isolation_forest_scores(works, now)

    # ---- method 2: z-score by category ----
    category_stats: dict[str, tuple[float, float]] = {}
    by_cat: dict[str, list[Work]] = {}
    for w in works:
        by_cat.setdefault(w.work_category, []).append(w)
    for cat, ws in by_cat.items():
        vals = np.array([_overrun(w) for w in ws], dtype=float)
        vals = vals[~np.isnan(vals)]
        if len(vals) >= 3:
            mu, sd = float(vals.mean()), float(vals.std())
            if sd > 1e-9:
                category_stats[cat] = (mu, sd)

    created = 0
    for w in works:
        overrun = _overrun(w)
        if overrun is None or overrun <= THRESHOLD_PCT:
            continue
        methods: list[str] = ["THRESHOLD"]
        z = None
        if w.work_category in category_stats:
            mu, sd = category_stats[w.work_category]
            z = (overrun - mu) / sd
            if abs(z) > ZSCORE_LIMIT:
                methods.append("ZSCORE")
        ml = if_score.get(str(w.id))
        if ml is not None and ml < 0:
            methods.append("ISOLATION_FOREST")
        session.add(Anomaly(
            id=uuid.uuid4(),
            work_id=w.id,
            constituency_id=w.constituency_id,
            anomaly_type=ANOMALY_TYPE,
            severity=_severity(overrun),
            confidence_score=round(_confidence(overrun), 4),
            detection_method="+".join(methods),
            details={
                "cost_overrun_percentage": round(overrun, 2),
                "sanctioned_amount": float(w.sanctioned_amount),
                "actual_expenditure": float(w.actual_expenditure),
                "z_score": round(z, 4) if z is not None else None,
                "ml_anomaly_score": round(ml, 4) if ml is not None else None,
                "work_ref": w.work_id,
            },
            status="NEW",
            detected_at=now,
        ))
        created += 1
    session.commit()
    return created


def _overrun(w: Work) -> float | None:
    s = float(w.sanctioned_amount)
    if s <= 0:
        return None
    return (float(w.actual_expenditure or 0) - s) / s * 100.0


def _isolation_forest_scores(works: list[Work], now: datetime) -> dict[str, float]:
    from sklearn.ensemble import IsolationForest

    cat_encoder = {c: i for i, c in enumerate(sorted({w.work_category for w in works}))}
    X: list[list[float]] = []
    ids: list[str] = []
    for w in works:
        overrun = _overrun(w) or 0.0
        days = 0
        if w.expected_completion_date:
            days = (w.expected_completion_date - (w.sanction_date or date.today())).days
        X.append([float(w.sanctioned_amount), float(w.actual_expenditure or 0),
                  overrun, float(days), float(cat_encoder[w.work_category])])
        ids.append(str(w.id))
    X = np.array(X, dtype=float)
    X = np.nan_to_num(X)
    model = IsolationForest(contamination=0.05, random_state=42, n_jobs=1)
    model.fit(X)
    scores = model.decision_function(X)  # negative => anomaly
    return {wid: float(s) for wid, s in zip(ids, scores)}


def clear_cost_overrun(session: Session) -> None:
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type == ANOMALY_TYPE))
    session.commit()
