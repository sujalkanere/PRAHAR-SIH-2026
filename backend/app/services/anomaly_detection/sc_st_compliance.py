"""SC/ST allocation compliance detector (Q1.5).

MPLADS statutory rule:
For each MP / financial year:
  SC% = SUM(sanctioned_amount WHERE beneficiary_category = 'SC') / total_sanctioned * 100
  ST% = SUM(sanctioned_amount WHERE beneficiary_category = 'ST') / total_sanctioned * 100

  IF SC% < sc_allocation_target_pct:
      status = 'VIOLATION' if SC% < (target * 0.7) else 'AT_RISK'
  IF ST% < st_allocation_target_pct:
      status = 'VIOLATION' if ST% < (target * 0.7) else 'AT_RISK'
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Constituency, SCSTCompliance, Work


def clear_sc_st_compliance(session: Session) -> None:
    session.execute(delete(SCSTCompliance))
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type == "SC_ST_VIOLATION"))
    session.commit()


def detect_sc_st_compliance(session: Session, reference_date=None) -> int:
    """Evaluates SC/ST allocation quotas across all constituencies and financial years."""
    constituencies = {c.id: c for c in session.execute(select(Constituency)).scalars().all()}
    if not constituencies:
        return 0

    # Query aggregates grouped by constituency and financial_year
    q = select(
        Work.constituency_id,
        Work.financial_year,
        func.coalesce(func.sum(Work.sanctioned_amount), 0).label("total_sanctioned"),
        func.coalesce(
            func.sum(
                case(
                    (Work.beneficiary_category == "SC", Work.sanctioned_amount),
                    else_=0,
                )
            ),
            0,
        ).label("sc_sanctioned"),
        func.coalesce(
            func.sum(
                case(
                    (Work.beneficiary_category == "ST", Work.sanctioned_amount),
                    else_=0,
                )
            ),
            0,
        ).label("st_sanctioned"),
    ).group_by(Work.constituency_id, Work.financial_year)

    rows = session.execute(q).all()
    now = datetime.now(timezone.utc)
    anomalies_created = 0

    for cid, fy, total_sanc, sc_sanc, st_sanc in rows:
        c = constituencies.get(cid)
        if not c:
            continue

        tot = float(total_sanc or 0)
        sc_amt = float(sc_sanc or 0)
        st_amt = float(st_sanc or 0)

        sc_pct = round((sc_amt / tot * 100.0), 2) if tot > 0 else 0.0
        st_pct = round((st_amt / tot * 100.0), 2) if tot > 0 else 0.0

        sc_target = float(c.sc_allocation_target_pct if c.sc_allocation_target_pct is not None else 15.00)
        st_target = float(c.st_allocation_target_pct if c.st_allocation_target_pct is not None else 7.50)

        # Status logic per statutory guideline thresholds
        status = "COMPLIANT"
        if tot > 0:
            if sc_pct < sc_target or st_pct < st_target:
                if sc_pct < (sc_target * 0.70) or st_pct < (st_target * 0.70):
                    status = "VIOLATION"
                else:
                    status = "AT_RISK"
        else:
            status = "COMPLIANT"

        # Record into sc_st_compliance table
        record = SCSTCompliance(
            id=uuid.uuid4(),
            constituency_id=cid,
            financial_year=fy,
            sc_pct_actual=sc_pct,
            sc_pct_target=sc_target,
            st_pct_actual=st_pct,
            st_pct_target=st_target,
            status=status,
            calculated_at=now,
        )
        session.add(record)

        if status in ("VIOLATION", "AT_RISK"):
            severity = "HIGH" if status == "VIOLATION" else "MEDIUM"
            note = (
                f"Statutory SC/ST quota shortfall for FY {fy}: "
                f"SC allocation is {sc_pct}% (target {sc_target}%), "
                f"ST allocation is {st_pct}% (target {st_target}%)."
            )
            session.add(
                Anomaly(
                    id=uuid.uuid4(),
                    work_id=None,
                    constituency_id=cid,
                    anomaly_type="SC_ST_VIOLATION",
                    severity=severity,
                    confidence_score=0.98,
                    detection_method="STATUTORY_RULE",
                    details={
                        "constituency_name": c.name,
                        "state": c.state,
                        "financial_year": fy,
                        "sc_pct_actual": sc_pct,
                        "sc_pct_target": sc_target,
                        "st_pct_actual": st_pct,
                        "st_pct_target": st_target,
                        "total_sanctioned": tot,
                        "sc_sanctioned": sc_amt,
                        "st_sanctioned": st_amt,
                        "status": status,
                    },
                    status="NEW",
                    note=note,
                    detected_at=now,
                )
            )
            anomalies_created += 1

    session.commit()
    return anomalies_created
