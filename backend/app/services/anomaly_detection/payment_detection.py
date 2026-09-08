"""Payment risk detection (Target 6-Risk Dimension 3).

Detects:
- Premature fund exhaustion / high payment ratio with early/incomplete status (PAY-001)
- Actual expenditure exceeding sanctioned amount without sanction revision (PAY-002)
- Zero expenditure on completed works (data integrity / unrecorded payment) (PAY-003)
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Work

ANOMALY_TYPE = "PAYMENT_RISK"


def clear_payment_risk(session: Session) -> int:
    deleted = session.execute(
        delete(Anomaly).where(Anomaly.anomaly_type == ANOMALY_TYPE)
    ).rowcount
    session.commit()
    return deleted or 0


def detect_payment_risk(session: Session, reference_date: date | None = None) -> int:
    ref = reference_date or date.today()
    works = list(session.execute(select(Work)).scalars().all())
    now = datetime.now(timezone.utc)
    created = 0

    for w in works:
        sanctioned = float(w.sanctioned_amount or 0)
        expenditure = float(w.actual_expenditure or 0)
        status = (w.work_status or "").upper()

        if sanctioned <= 0:
            continue

        pay_ratio = expenditure / sanctioned

        # Signal 1: High payment with low physical maturity (premature full disbursement)
        if status in ("SANCTIONED", "NOT_STARTED") and pay_ratio > 0.50:
            severity = "CRITICAL" if pay_ratio > 0.80 else "HIGH"
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity=severity,
                    confidence_score=0.92,
                    detection_method="PAYMENT_RATIO_RULE",
                    details={
                        "rule_id": "PAY-001",
                        "signal": "PREMATURE_DISBURSEMENT",
                        "pay_ratio": round(pay_ratio, 2),
                        "actual_expenditure": expenditure,
                        "sanctioned_amount": sanctioned,
                        "work_status": status,
                        "threshold": 0.50,
                        "reason": f"Project marked {status} but has already disbursed {int(pay_ratio*100)}% of sanctioned funds",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

        # Signal 2: Unreconciled expenditure exceeding sanction (payment overflow)
        elif pay_ratio > 1.25 and status in ("IN_PROGRESS", "SANCTIONED"):
            severity = "CRITICAL" if pay_ratio > 1.50 else "HIGH"
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity=severity,
                    confidence_score=0.95,
                    detection_method="EXPENDITURE_OVERFLOW",
                    details={
                        "rule_id": "PAY-002",
                        "signal": "UNRECONCILED_PAYMENT_OVERFLOW",
                        "pay_ratio": round(pay_ratio, 2),
                        "actual_expenditure": expenditure,
                        "sanctioned_amount": sanctioned,
                        "threshold": 1.25,
                        "reason": f"Disbursed expenditure exceeds sanction by {int((pay_ratio - 1)*100)}% without formal sanction revision",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

        # Signal 3: Work completed with zero reported expenditure (unreported payment anomaly)
        elif status == "COMPLETED" and expenditure <= 0:
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=w.id,
                    constituency_id=w.constituency_id,
                    anomaly_type=ANOMALY_TYPE,
                    severity="MEDIUM",
                    confidence_score=0.88,
                    detection_method="MISSING_EXPENDITURE",
                    details={
                        "rule_id": "PAY-003",
                        "signal": "COMPLETED_WITHOUT_PAYMENT_RECORD",
                        "actual_expenditure": 0,
                        "sanctioned_amount": sanctioned,
                        "threshold": 0,
                        "reason": "Work marked completed but reports zero expenditure in financial records",
                    },
                    status="NEW",
                    detected_at=now,
                )
            )
            created += 1

    session.commit()
    return created
