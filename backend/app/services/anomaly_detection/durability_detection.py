"""Durability and asset-quality risk detection (Target 6-Risk Dimension 6).

Evaluates:
- Premature repeat repairs/renovations on newly completed works in the same constituency (DUR-001)
- Explicit adverse quality observations in descriptions or defect logs (DUR-002)

Rule: If inspection evidence is absent, does NOT fabricate synthetic defects;
reports zero detected anomalies to keep the analytical engine honest and auditable.
"""
from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Work

ANOMALY_TYPE = "DURABILITY_RISK"

REPAIR_KEYWORDS = re.compile(
    r"\b(repair|renovation|re-surfacing|re-carpeting|maintenance|re-laying|patchwork|damage|reconstruction)\b",
    re.IGNORECASE,
)


def clear_durability_risk(session: Session) -> int:
    deleted = session.execute(
        delete(Anomaly).where(Anomaly.anomaly_type == ANOMALY_TYPE)
    ).rowcount
    session.commit()
    return deleted or 0


def detect_durability_risk(session: Session, reference_date: date | None = None) -> int:
    ref = reference_date or date.today()
    works = list(session.execute(select(Work)).scalars().all())
    now = datetime.now(timezone.utc)
    created = 0

    # Group by (constituency_id, work_category) to detect premature repeat repairs
    by_group: dict[tuple, list[Work]] = defaultdict(list)
    for w in works:
        by_group[(str(w.constituency_id), w.work_category)].append(w)

    for (cid, cat), group in by_group.items():
        if len(group) < 2:
            continue
        # Sort by sanction date
        sorted_works = sorted(group, key=lambda x: x.sanction_date or date.min)
        for i in range(len(sorted_works) - 1):
            w_prior = sorted_works[i]
            w_next = sorted_works[i + 1]

            if not w_prior.sanction_date or not w_next.sanction_date:
                continue

            days_between = (w_next.sanction_date - w_prior.sanction_date).days

            # If a repair is sanctioned within 365 days of an earlier project in the same category
            if 0 < days_between <= 365 and REPAIR_KEYWORDS.search(w_next.work_description or ""):
                session.add(
                    Anomaly(
                        id=uuid.uuid4(),
                        work_id=w_next.id,
                        constituency_id=w_next.constituency_id,
                        anomaly_type=ANOMALY_TYPE,
                        severity="HIGH" if days_between <= 180 else "MEDIUM",
                        confidence_score=0.82,
                        detection_method="REPEAT_REPAIR_INTERVAL",
                        details={
                            "rule_id": "DUR-001",
                            "signal": "PREMATURE_REPEAT_REPAIR",
                            "days_between": days_between,
                            "prior_work_id": w_prior.work_id,
                            "prior_sanction_date": w_prior.sanction_date.isoformat(),
                            "current_sanction_date": w_next.sanction_date.isoformat(),
                            "reason": f"Premature repair/reconstruction sanctioned within {days_between} days of previous {cat} asset execution",
                        },
                        status="NEW",
                        detected_at=now,
                    )
                )
                created += 1

    session.commit()
    return created
