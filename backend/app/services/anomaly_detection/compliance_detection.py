"""Compliance risk detection (Target 6-Risk Dimension 5).

Detects:
- Chronological anomalies: completion date before sanction date or sanction date in the future (CMP-001)
- Missing / generic implementing agency mapping (CMP-002)
- Zero-duration / impossible completion timelines (CMP-003)
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Work

ANOMALY_TYPE = "COMPLIANCE_RISK"


def clear_compliance_risk(session: Session) -> int:
    deleted = session.execute(
        delete(Anomaly).where(Anomaly.anomaly_type == ANOMALY_TYPE)
    ).rowcount
    session.commit()
    return deleted or 0


def detect_compliance_risk(session: Session, reference_date: date | None = None) -> int:
    ref = reference_date or date.today()
    works = list(session.execute(select(Work)).scalars().all())
    now = datetime.now(timezone.utc)
    created = 0

    for w in works:
        sdate = w.sanction_date
        cdate = w.completion_date
        edate = w.expected_completion_date
        agency = (w.implementing_agency or "").strip().lower()

        # Signal 1: Chronological inconsistency
        if sdate and cdate and cdate < sdate:
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity="CRITICAL",
                    confidence_score=0.99,
                    detection_method="CHRONOLOGY_RULE",
                    details={
                        "rule_id": "CMP-001",
                        "signal": "COMPLETION_PRE_SANCTION",
                        "sanction_date": sdate.isoformat(),
                        "completion_date": cdate.isoformat(),
                        "reason": f"Completion date ({cdate}) predates administrative sanction date ({sdate})",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

        # Signal 2: Missing or unmapped implementing agency
        elif not agency or agency in ("general", "unassigned", "unknown", "district authority", "na", "n/a", "none", "-"):
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity="MEDIUM",
                    confidence_score=0.90,
                    detection_method="MANDATORY_FIELD_RULE",
                    details={
                        "rule_id": "CMP-002",
                        "signal": "GENERIC_AGENCY_MAPPING",
                        "implementing_agency": w.implementing_agency or "None",
                        "reason": "Missing or unmapped executive agency responsible for project execution and audit accountability",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

        # Signal 3: Impossible timeline (e.g. expected completion on or before sanction date for multi-lakh infrastructure)
        elif sdate and edate and edate <= sdate and float(w.sanctioned_amount or 0) > 100000:
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity="HIGH",
                    confidence_score=0.85,
                    detection_method="TIMELINE_FEASIBILITY",
                    details={
                        "rule_id": "CMP-003",
                        "signal": "ZERO_DURATION_TARGET",
                        "sanction_date": sdate.isoformat(),
                        "expected_completion_date": edate.isoformat(),
                        "sanctioned_amount": float(w.sanctioned_amount),
                        "reason": f"Expected completion target ({edate}) affords <= 0 days for public works execution from sanction",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

    session.commit()
    return created
