"""Inspection quota compliance detector (Q2.1).

District Authorities must physically inspect >=10% of active works.
For each district / financial year:
  works_in_progress = COUNT(works WHERE district = X AND status IN ('SANCTIONED','IN_PROGRESS') AND financial_year = Y)
  works_inspected = COUNT(DISTINCT work_id FROM inspections WHERE district = X AND financial_year = Y)
  coverage_pct = works_inspected / works_in_progress * 100

  IF coverage_pct < 10.0:
      status = 'QUOTA_VIOLATION'
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Constituency, Inspection, InspectionCoverage, Work


def clear_inspection_quota(session: Session) -> None:
    session.execute(delete(InspectionCoverage))
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type == "INSPECTION_QUOTA_VIOLATION"))
    session.commit()


def detect_inspection_quota(session: Session, reference_date=None) -> int:
    """Evaluates the 10% physical inspection quota for each district."""
    
    # Get all active works by district and FY
    works_q = select(
        Constituency.district,
        Work.financial_year,
        func.count(Work.id).label("works_in_progress"),
    ).join(Constituency, Work.constituency_id == Constituency.id).where(
        Work.work_status.in_(["SANCTIONED", "IN_PROGRESS"]),
        Constituency.district.is_not(None)
    ).group_by(Constituency.district, Work.financial_year)

    active_works = session.execute(works_q).all()
    if not active_works:
        return 0

    # Get distinct inspections per district and FY (using Inspection date's FY logic - for now we just map by date.year roughly, or since Inspection doesn't have FY, we group by district and extract FY from date, or we just count all inspections in that FY for works in that district)
    # Actually, the simplest approach for FY based on date:
    # A standard FY is April 1 to March 31.
    
    # Let's just pull all inspections and group them in python to avoid complex SQL date maths for now
    inspections = session.execute(select(Inspection)).scalars().all()
    inspected_works_by_dist_fy = {}
    for insp in inspections:
        fy_year = insp.inspection_date.year
        if insp.inspection_date.month < 4:
            fy_year -= 1
        fy = f"{fy_year}-{str(fy_year + 1)[-2:]}"
        key = (insp.district, fy)
        if key not in inspected_works_by_dist_fy:
            inspected_works_by_dist_fy[key] = set()
        inspected_works_by_dist_fy[key].add(str(insp.work_id))

    constituencies = session.execute(select(Constituency)).scalars().all()
    dist_to_consts = {}
    for c in constituencies:
        if c.district:
            if c.district not in dist_to_consts:
                dist_to_consts[c.district] = []
            dist_to_consts[c.district].append(c)

    now = datetime.now(timezone.utc)
    anomalies_created = 0

    for district, fy, wip in active_works:
        if wip == 0:
            continue
            
        inspected = len(inspected_works_by_dist_fy.get((district, fy), set()))
        coverage_pct = round((inspected / wip * 100.0), 2)
        
        status = "COMPLIANT"
        severity = None
        if coverage_pct < 10.0:
            status = "QUOTA_VIOLATION"
            severity = "CRITICAL" if coverage_pct < 5.0 else "HIGH"
            
        # Record into inspection_coverage table
        record = InspectionCoverage(
            id=uuid.uuid4(),
            district=district,
            financial_year=fy,
            works_in_progress=wip,
            works_inspected=inspected,
            coverage_pct=coverage_pct,
            status=status,
            calculated_at=now,
        )
        session.add(record)
        
        if status == "QUOTA_VIOLATION" and severity:
            note = f"District {district} failed the 10% inspection quota for FY {fy}. Coverage is {coverage_pct}% ({inspected}/{wip} works)."
            
            # Create anomalies for constituencies in this district
            for c in dist_to_consts.get(district, []):
                session.add(
                    Anomaly(
                        id=uuid.uuid4(),
                        work_id=None,
                        constituency_id=c.id,
                        anomaly_type="INSPECTION_QUOTA_VIOLATION",
                        severity=severity,
                        confidence_score=1.0,
                        detection_method="STATUTORY_RULE",
                        details={
                            "district": district,
                            "financial_year": fy,
                            "works_in_progress": wip,
                            "works_inspected": inspected,
                            "coverage_pct": coverage_pct,
                            "target_pct": 10.0,
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
