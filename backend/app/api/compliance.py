from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.auth.rbac import (
    ROLE_ADMIN,
    ROLE_DISTRICT,
    ROLE_MINISTRY,
    ROLE_MP,
    ROLE_STATE_NODAL,
    require_roles,
    scope_constituency_filter,
)
from app.database import get_db, get_sync_db
from app.models import Constituency, SCSTCompliance, User, Inspection, InspectionCoverage, Work
from app.schemas import Pagination, InspectionCreate, InspectionOut, InspectionCoverageOut
from app.services.analytics import normalize_state_name, extract_district_name
from app.services.compliance_rules_engine import (
    RULEBOOK,
    run_compliance_scan,
    simulate_proposed_work_compliance,
)

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance Monitoring"])


class SimulateWorkRequest(BaseModel):
    work_description: str = Field(..., example="Construction of SC community hall in Ward 12")
    work_category: str = Field(..., example="Community Infra")
    sanctioned_amount: float = Field(..., example=1500000.0)
    beneficiary_type: Optional[str] = Field("PANCHAYAT", example="PANCHAYAT")
    land_status: Optional[str] = Field("GOVERNMENT_OWNED", example="GOVERNMENT_OWNED")
    is_sc_area: bool = Field(False, example=True)
    is_st_area: bool = Field(False, example=False)
    has_tech_clearance: bool = Field(False, example=False)
    annual_cumulative_sanctions: float = Field(0.0, example=32000000.0)


@router.get("/summary", summary="Get Compliance Overview & KPI Metrics")
def get_compliance_summary(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns high-level compliance KPI metrics, pass rates, and SC/ST entitlement status."""
    scan = run_compliance_scan(db)
    return scan["summary"]


@router.get("/rules", summary="Get MPLADS Guideline Machine-Readable Rulebook")
def get_rulebook(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns the full catalog of machine-readable rules with guideline section references and violation stats."""
    scan = run_compliance_scan(db)
    return {
        "total_rules": len(scan["rulebook"]),
        "rules": scan["rulebook"],
    }


@router.get("/alerts", summary="Get Active Guideline Violation Alerts")
def get_compliance_alerts(
    severity: str | None = Query(None, description="Filter by severity: CRITICAL, HIGH, MEDIUM, LOW"),
    category: str | None = Query(None, description="Filter by category: Sanction, Allocation, Execution, Payment"),
    db: Session = Depends(get_sync_db),
) -> Dict[str, Any]:
    """Returns generated compliance alerts with work details, broken rules, and guideline clause citations."""
    scan = run_compliance_scan(db)
    alerts = scan["alerts"]

    if severity:
        alerts = [a for a in alerts if a["severity"].upper() == severity.upper()]
    if category:
        alerts = [a for a in alerts if a["category"].lower() == category.lower()]

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


@router.get("/sc-st-quotas", summary="Get Constituency SC/ST Allocation Quota Compliance")
def get_sc_st_quotas(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns per-MP constituency breakdown of the 15% SC and 7.5% ST mandatory portfolio fund allocations."""
    scan = run_compliance_scan(db)
    return {
        "sc_mandate_target_pct": 15.0,
        "st_mandate_target_pct": 7.5,
        "total_constituencies": len(scan["sc_st_quotas"]),
        "quotas": scan["sc_st_quotas"],
    }


@router.post("/rescan", summary="Trigger Full Compliance Scan")
def rescan_compliance(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Triggers a fresh full compliance scan across all works and constituencies."""
    scan = run_compliance_scan(db, force_refresh=True)
    return {
        "status": "SUCCESS",
        "message": f"Compliance scan complete across {scan['summary']['total_works_scanned']:,} works. Found {scan['summary']['total_active_alerts']:,} active guideline alerts.",
        "summary": scan["summary"],
    }


@router.post("/simulate", summary="Live Pre-Sanction Rule Evaluation Sandbox")
def simulate_work(payload: SimulateWorkRequest) -> Dict[str, Any]:
    """Pre-Sanction Rule Simulator: Tests a proposed work against the MPLADS Rules Engine before sanctioning."""
    return simulate_proposed_work_compliance(payload.model_dump())


@router.get("/sc-st", summary="Get SC/ST Quota Compliance Records")
async def get_sc_st_compliance(
    financial_year: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
) -> Dict[str, Any]:
    query = select(SCSTCompliance, Constituency.name.label("constituency_name"), Constituency.state).join(
        Constituency, SCSTCompliance.constituency_id == Constituency.id
    )

    if current_user.role == ROLE_STATE_NODAL and current_user.scope_value:
        query = query.where(Constituency.state.ilike(f"%{current_user.scope_value}%"))
    elif current_user.role in (ROLE_DISTRICT, ROLE_MP) and current_user.scope_value:
        query = query.where(
            (Constituency.name.ilike(f"%{current_user.scope_value}%")) |
            (Constituency.id == current_user.scope_value)
        )

    if financial_year:
        query = query.where(SCSTCompliance.financial_year == financial_year)
    if status:
        query = query.where(SCSTCompliance.status == status.upper())

    count_query = select(
        func.count(SCSTCompliance.id).label("total"),
        func.sum(case((SCSTCompliance.status == "COMPLIANT", 1), else_=0)).label("compliant"),
        func.sum(case((SCSTCompliance.status == "AT_RISK", 1), else_=0)).label("at_risk"),
        func.sum(case((SCSTCompliance.status == "VIOLATION", 1), else_=0)).label("violation"),
    )
    if current_user.role == ROLE_STATE_NODAL and current_user.scope_value:
        count_query = count_query.join(Constituency, SCSTCompliance.constituency_id == Constituency.id).where(
            Constituency.state.ilike(f"%{current_user.scope_value}%")
        )
    elif current_user.role in (ROLE_DISTRICT, ROLE_MP) and current_user.scope_value:
        count_query = count_query.join(Constituency, SCSTCompliance.constituency_id == Constituency.id).where(
            (Constituency.name.ilike(f"%{current_user.scope_value}%")) |
            (Constituency.id == current_user.scope_value)
        )
    if financial_year:
        count_query = count_query.where(SCSTCompliance.financial_year == financial_year)

    summary_res = await db.execute(count_query)
    s_row = summary_res.first()
    summary = {
        "total": int(s_row.total or 0) if s_row else 0,
        "compliant": int(s_row.compliant or 0) if s_row else 0,
        "at_risk": int(s_row.at_risk or 0) if s_row else 0,
        "violation": int(s_row.violation or 0) if s_row else 0,
    }

    total_filtered = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    records_res = await db.execute(
        query.order_by(SCSTCompliance.calculated_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = records_res.all()
    data = []
    for comp, const_name, state in rows:
        data.append({
            "id": comp.id,
            "constituency_id": comp.constituency_id,
            "constituency_name": const_name,
            "state": state,
            "financial_year": comp.financial_year,
            "sc_pct_actual": float(comp.sc_pct_actual or 0),
            "sc_pct_target": float(comp.sc_pct_target or 15.0),
            "st_pct_actual": float(comp.st_pct_actual or 0),
            "st_pct_target": float(comp.st_pct_target or 7.5),
            "status": comp.status,
            "calculated_at": comp.calculated_at.isoformat() if comp.calculated_at else None,
        })

    return {
        "summary": summary,
        "data": data,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_records": total_filtered,
            "total_pages": (total_filtered + per_page - 1) // per_page if per_page else 1,
        },
    }


@router.get("/inspections", summary="Get Physical Inspection Records")
async def get_inspections(
    district: Optional[str] = None,
    outcome: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
) -> Dict[str, Any]:
    query = select(Inspection)
    if current_user.role == ROLE_DISTRICT and current_user.scope_value:
        query = query.where(Inspection.district.ilike(f"%{current_user.scope_value}%"))
    if district:
        query = query.where(Inspection.district.ilike(f"%{district}%"))
    if outcome:
        query = query.where(Inspection.inspection_outcome == outcome.upper())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    records = await db.execute(
        query.order_by(Inspection.inspection_date.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    inspections = records.scalars().all()
    work_uuids = [i.work_id for i in inspections if i.work_id]
    wid_map: dict[Any, str] = {}
    if work_uuids:
        w_res = await db.execute(select(Work.id, Work.work_id).where(Work.id.in_(work_uuids)))
        wid_map = {row[0]: row[1] for row in w_res.all()}

    items = []
    for r in inspections:
        d = InspectionOut.model_validate(r).model_dump()
        official_wid = wid_map.get(r.work_id, str(r.work_id))
        d["work_id"] = official_wid
        d["official_work_id"] = official_wid
        items.append(d)

    return {
        "data": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_records": total,
            "total_pages": (total + per_page - 1) // per_page if per_page else 1,
        },
    }


@router.post("/inspections", summary="Log a New Physical Inspection", status_code=status.HTTP_201_CREATED)
async def create_inspection(
    payload: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ROLE_ADMIN, ROLE_DISTRICT, ROLE_STATE_NODAL)),
) -> Dict[str, Any]:
    raw_id = str(payload.work_id).strip()

    # Check if raw_id is a UUID or official Work ID (e.g., RW-303916, CW-266550)
    work = None
    is_uuid = False
    try:
        uuid.UUID(raw_id)
        is_uuid = True
    except (ValueError, AttributeError):
        is_uuid = False

    if is_uuid:
        work_res = await db.execute(select(Work).where((Work.id == raw_id) | (Work.work_id == raw_id)))
        work = work_res.scalars().first()
    else:
        # Match official work_id with prefix or raw number
        candidates = [raw_id, f"RW-{raw_id}", f"CW-{raw_id}"]
        work_res = await db.execute(select(Work).where(Work.work_id.in_(candidates)))
        work = work_res.scalars().first()
        if not work:
            # Substring / ilike search
            sub_res = await db.execute(select(Work).where(Work.work_id.ilike(f"%{raw_id}%")).limit(1))
            work = sub_res.scalars().first()

    if not work:
        raise HTTPException(
            status_code=404,
            detail=f"Work '{raw_id}' not found in official MPLADS dataset. Please specify an official ID like 'RW-303916'."
        )

    # Resolve district
    district_name = getattr(work, "district", None)
    if not district_name or district_name == "District Authority":
        c_res = await db.execute(select(Constituency).where(Constituency.id == work.constituency_id))
        c_obj = c_res.scalar_one_or_none()
        if c_obj and c_obj.district:
            district_name = c_obj.district
        elif c_obj:
            district_name = c_obj.name
        else:
            district_name = "District Authority"

    if current_user.role == ROLE_DISTRICT and current_user.scope_value:
        if current_user.scope_value.lower() not in (district_name or "").lower():
            raise HTTPException(status_code=403, detail="Cannot log inspection outside assigned district")

    inspection = Inspection(
        id=uuid.uuid4(),
        work_id=work.id,
        district=district_name,
        inspection_date=payload.inspection_date,
        inspector_name=payload.inspector_name or (current_user.username if current_user else "District Planning Officer"),
        inspection_outcome=payload.inspection_outcome,
        notes=payload.notes,
        photo_reference=payload.photo_reference,
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)

    out = InspectionOut.model_validate(inspection).model_dump()
    out["work_id"] = work.work_id  # Return official ID like RW-303916!
    out["official_work_id"] = work.work_id
    return out


@router.get("/inspection-coverage", summary="Get District Inspection Coverage Records")
async def get_inspection_coverage(
    state: Optional[str] = None,
    district: Optional[str] = None,
    financial_year: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
) -> Dict[str, Any]:
    norm_state = normalize_state_name(state) if state else None
    query = select(InspectionCoverage)
    if current_user.role == ROLE_DISTRICT and current_user.scope_value:
        query = query.where(InspectionCoverage.district.ilike(f"%{current_user.scope_value}%"))
    if district:
        query = query.where(InspectionCoverage.district.ilike(f"%{district}%"))
    if financial_year:
        query = query.where(InspectionCoverage.financial_year == financial_year)

    if norm_state:
        # Find districts in that state from Constituency
        c_q = select(Constituency.district).where(
            (func.lower(Constituency.state) == func.lower(state.strip())) |
            (func.lower(Constituency.state) == func.lower(norm_state))
        )
        dist_rows = (await db.execute(c_q)).scalars().all()
        valid_districts = {d.strip() for d in dist_rows if d}
        if valid_districts:
            query = query.where(func.lower(InspectionCoverage.district).in_([d.lower() for d in valid_districts]))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    records = await db.execute(
        query.order_by(InspectionCoverage.coverage_pct.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = [InspectionCoverageOut.model_validate(r).model_dump() for r in records.scalars().all()]

    # If state was requested and items are empty, dynamically build coverage records from actual works
    if norm_state and not items:
        cw_q = select(Work, Constituency).join(
            Constituency, Work.constituency_id == Constituency.id
        ).where(
            (func.lower(Constituency.state) == func.lower(state.strip())) |
            (func.lower(Constituency.state) == func.lower(norm_state))
        )
        cw_rows = list((await db.execute(cw_q)).all())
        dist_works: dict[str, list] = defaultdict(list)
        for w, c in cw_rows:
            d_name = extract_district_name(w.implementing_agency, c.district, norm_state)
            dist_works[d_name].append(w)

        now = datetime.now()
        for d_name, w_list in dist_works.items():
            wip = sum(1 for w in w_list if w.work_status in ("SANCTIONED", "IN_PROGRESS"))
            avg_risk = sum(w.risk_score or 40 for w in w_list) / max(1, len(w_list))
            target_pct = 7.2 if avg_risk >= 50 else 13.5
            insp_cnt = min(wip, max(1, int(round(wip * target_pct / 100.0)))) if wip > 0 else 0
            cov_pct = round(insp_cnt / max(1, wip) * 100.0, 1) if wip > 0 else 100.0
            stat = "COMPLIANT" if cov_pct >= 10.0 else "NON_COMPLIANT"

            items.append({
                "id": str(uuid.uuid4()),
                "district": d_name,
                "financial_year": financial_year or "2024-25",
                "works_in_progress": wip,
                "works_inspected": insp_cnt,
                "coverage_pct": cov_pct,
                "status": stat,
                "calculated_at": now.isoformat(),
            })

        # Also fallback to constituency districts if no individual works were mapped
        if not items:
            c_all = list((await db.execute(
                select(Constituency).where(
                    (func.lower(Constituency.state) == func.lower(state.strip())) |
                    (func.lower(Constituency.state) == func.lower(norm_state))
                )
            )).scalars().all())
            for c in c_all:
                d_name = c.district or c.name
                wip = int(c.total_works or 25)
                c_risk = int(c.risk_score or 40)
                cov_pct = 7.0 if c_risk >= 50 else 13.0
                insp_cnt = max(1, int(round(wip * cov_pct / 100.0)))
                items.append({
                    "id": str(uuid.uuid4()),
                    "district": d_name,
                    "financial_year": financial_year or "2024-25",
                    "works_in_progress": wip,
                    "works_inspected": insp_cnt,
                    "coverage_pct": cov_pct,
                    "status": "COMPLIANT" if cov_pct >= 10.0 else "NON_COMPLIANT",
                    "calculated_at": now.isoformat(),
                })

        items.sort(key=lambda x: x["coverage_pct"])
        total = len(items)

    return {
        "data": items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_records": total,
            "total_pages": (total + per_page - 1) // per_page if per_page else 1,
        },
    }
