"""Suspicious pattern detection (FR-ADE-005)."""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Constituency, Work

ANOMALY_TYPES = ("AMOUNT_CLUSTERING", "END_OF_YEAR_RUSH", "ROUND_NUMBER_BIAS", "AGENCY_CONCENTRATION")


def detect_patterns(session: Session, reference_date=None) -> int:
    works = list(session.execute(select(Work)).scalars().all())
    consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}
    now = datetime.now(timezone.utc)

    groups: dict[tuple[str, str], list[Work]] = {}
    for w in works:
        groups.setdefault((str(w.constituency_id), w.financial_year), []).append(w)

    created = 0
    for (cid, fy), ws in groups.items():
        const = consts[cid]

        # ---- pattern 1: amount clustering ----
        amount_counts: Counter = Counter(float(w.sanctioned_amount) for w in ws)
        for amount, count in amount_counts.items():
            if count >= 5:
                work_ids = [w.work_id for w in ws if float(w.sanctioned_amount) == amount]
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="AMOUNT_CLUSTERING",
                    severity="HIGH" if count > 10 else "MEDIUM",
                    confidence_score=0.95, detection_method="RULE_BASED",
                    details={"amount": amount, "occurrences": count, "work_ids": work_ids,
                             "constituency": const.name, "financial_year": fy},
                    status="NEW", detected_at=now))
                created += 1

        # ---- pattern 2: end-of-year rush (March sanctions) ----
        if len(ws) >= 10:
            march = [w for w in ws if w.sanction_date.month == 3]
            ratio = len(march) / len(ws)
            if ratio > 0.40:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="END_OF_YEAR_RUSH",
                    severity="HIGH" if ratio > 0.60 else "MEDIUM",
                    confidence_score=min(0.98, 0.6 + ratio),
                    detection_method="RULE_BASED",
                    details={"march_sanctions": len(march), "total_sanctions": len(ws),
                             "ratio": round(ratio, 3), "constituency": const.name,
                             "financial_year": fy},
                    status="NEW", detected_at=now))
                created += 1

        # ---- pattern 3: round number bias ----
        if ws:
            round_amt = [w for w in ws if float(w.sanctioned_amount) % 100000 == 0]
            round_pct = len(round_amt) / len(ws)
            if round_pct > 0.80:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="ROUND_NUMBER_BIAS", severity="LOW",
                    confidence_score=0.85, detection_method="RULE_BASED",
                    details={"round_number_percentage": round(round_pct, 3),
                             "constituency": const.name, "financial_year": fy},
                    status="NEW", detected_at=now))
                created += 1

        # ---- pattern 4: single agency dominance ----
        total_amount = sum(float(w.sanctioned_amount) for w in ws)
        if total_amount > 0:
            agency_amounts: dict[str, float] = {}
            for w in ws:
                agency_amounts[w.implementing_agency or "Unknown"] = (
                    agency_amounts.get(w.implementing_agency or "Unknown", 0.0) + float(w.sanctioned_amount))
            top_agency, top_amount = max(agency_amounts.items(), key=lambda kv: kv[1])
            share = top_amount / total_amount
            if share > 0.80:
                session.add(Anomaly(
                    id=uuid.uuid4(), work_id=None, constituency_id=const.id,
                    anomaly_type="AGENCY_CONCENTRATION", severity="MEDIUM",
                    confidence_score=0.9, detection_method="RULE_BASED",
                    details={"agency": top_agency, "share": round(share, 3),
                             "agency_amount": round(top_amount, 2),
                             "constituency": const.name, "financial_year": fy},
                    status="NEW", detected_at=now))
                created += 1

    session.commit()
    return created


def clear_patterns(session: Session) -> None:
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type.in_(ANOMALY_TYPES)))
    session.commit()
