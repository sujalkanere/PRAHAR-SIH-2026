"""Delayed / stalled project detection (FR-ADE-003)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Work

DELAY_TYPE = "DELAYED_PROJECT"
STALLED_TYPE = "STALLED_PROJECT"


def _delay_severity(days: int) -> str:
    if days > 365:
        return "CRITICAL"
    if days > 180:
        return "HIGH"
    return "MEDIUM"


def detect_delays(session: Session, reference_date: date | None = None) -> int:
    ref = reference_date or date.today()
    now = datetime.now(timezone.utc)
    works = list(session.execute(select(Work)).scalars().all())

    created = 0
    for w in works:
        status = w.work_status
        # Ongoing works past expected completion
        if status in ("SANCTIONED", "IN_PROGRESS", "ON_HOLD") and w.expected_completion_date:
            if ref > w.expected_completion_date:
                delay = (ref - w.expected_completion_date).days
                if delay > 90:
                    session.add(Anomaly(
                        id=uuid.uuid4(), work_id=w.id, constituency_id=w.constituency_id,
                        anomaly_type=DELAY_TYPE, severity=_delay_severity(delay),
                        confidence_score=0.99, detection_method="RULE_BASED",
                        details={"delay_days": delay, "sanction_date": w.sanction_date.isoformat(),
                                 "expected_completion_date": w.expected_completion_date.isoformat(),
                                 "current_status": status, "work_ref": w.work_id},
                        status="NEW", detected_at=now,
                    ))
                    created += 1
        # Completed but severely late
        elif status == "COMPLETED" and w.completion_date and w.expected_completion_date:
            if w.completion_date > w.expected_completion_date:
                delay = (w.completion_date - w.expected_completion_date).days
                if delay > 180:
                    session.add(Anomaly(
                        id=uuid.uuid4(), work_id=w.id, constituency_id=w.constituency_id,
                        anomaly_type=DELAY_TYPE, severity="HIGH",
                        confidence_score=0.99, detection_method="RULE_BASED",
                        details={"delay_days": delay, "sanction_date": w.sanction_date.isoformat(),
                                 "expected_completion_date": w.expected_completion_date.isoformat(),
                                 "completion_date": w.completion_date.isoformat(),
                                 "current_status": status, "work_ref": w.work_id},
                        status="NEW", detected_at=now,
                    ))
                    created += 1
        # Stalled: sanctioned over a year ago, never started
        if status == "SANCTIONED" and w.sanction_date:
            age = (ref - w.sanction_date).days
            if age > 365:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=w.id, constituency_id=w.constituency_id,
                    anomaly_type=STALLED_TYPE, severity="HIGH",
                    confidence_score=0.98, detection_method="RULE_BASED",
                    details={"days_since_sanction": age, "sanction_date": w.sanction_date.isoformat(),
                             "work_ref": w.work_id},
                    status="NEW", detected_at=now,
                ))
                created += 1
    session.commit()
    return created


def clear_delays(session: Session) -> None:
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type.in_([DELAY_TYPE, STALLED_TYPE])))
    session.commit()
