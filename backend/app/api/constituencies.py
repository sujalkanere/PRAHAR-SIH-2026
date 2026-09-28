"""Constituency endpoints (FR-API-001)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import (
    ROLE_ADMIN, ROLE_DISTRICT, ROLE_MINISTRY, ROLE_MP, ROLE_STATE_NODAL,
    get_current_user, require_roles,
)
from app.database import get_db
from app.models import Anomaly, Constituency, User, Work
from app.schemas import Pagination

router = APIRouter(prefix="/api/v1/constituencies", tags=["constituencies"])


@router.get("")
async def list_constituencies(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL,
                                    ROLE_DISTRICT, ROLE_MP)),
):
    from app.auth.rbac import scope_constituency_filter
    from app.services.analytics import latest_fy, _risk_rows

    ids = await scope_constituency_filter(db, user)
    fy = await latest_fy(db)
    q = select(Constituency)
    if ids is not None:
        if not ids:
            return {"data": [], "pagination": Pagination(page=page, per_page=per_page,
                                                        total_records=0, total_pages=0)}
        q = q.where(Constituency.id.in_(ids))
    if state:
        q = q.where(Constituency.state == state)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    consts = (await db.execute(q.order_by(Constituency.state, Constituency.name)
                               .offset((page - 1) * per_page).limit(per_page))).scalars().all()

    risk_map = {r["id"]: r for r in await _risk_rows(db, ids, fy)}
    anomaly_counts: dict[str, int] = {}
    works_counts: dict[str, int] = {}
    exp_map: dict[str, float] = {}
    rel_map: dict[str, float] = {}
    from app.models import FundRelease

    if consts:
        cids = [c.id for c in consts]
        rows = (await db.execute(
            select(Anomaly.constituency_id, func.count(Anomaly.id))
            .where(Anomaly.constituency_id.in_(cids),
                   Anomaly.status.in_(("NEW", "ACKNOWLEDGED", "UNDER_REVIEW")))
            .group_by(Anomaly.constituency_id))).all()
        anomaly_counts = {str(cid): n for cid, n in rows}

        w_rows = (await db.execute(
            select(Work.constituency_id, func.count(Work.id), func.coalesce(func.sum(Work.actual_expenditure), 0))
            .where(Work.constituency_id.in_(cids))
            .group_by(Work.constituency_id))).all()
        for cid, cnt, exp in w_rows:
            works_counts[str(cid)] = cnt
            exp_map[str(cid)] = float(exp)

        rel_rows = (await db.execute(
            select(FundRelease.constituency_id, func.coalesce(func.sum(FundRelease.amount_released), 0))
            .where(FundRelease.constituency_id.in_(cids))
            .group_by(FundRelease.constituency_id))).all()
        for cid, rel in rel_rows:
            rel_map[str(cid)] = float(rel)

        from app.models import SCSTCompliance
        sc_st_rows = (await db.execute(
            select(SCSTCompliance).where(SCSTCompliance.constituency_id.in_(cids))
            .order_by(SCSTCompliance.financial_year.desc())
        )).scalars().all()
        sc_st_map: dict[str, SCSTCompliance] = {}
        for sc_row in sc_st_rows:
            if str(sc_row.constituency_id) not in sc_st_map:
                sc_st_map[str(sc_row.constituency_id)] = sc_row

    data = []
    for c in consts:
        r = risk_map.get(str(c.id), {})
        tot_works = works_counts.get(str(c.id)) or r.get("total_works", 0)
        tot_exp = exp_map.get(str(c.id)) or r.get("total_expenditure", 0)
        tot_rel = rel_map.get(str(c.id)) or r.get("total_funds_released", 0)
        util_rate = round(tot_exp / tot_rel * 100, 1) if tot_rel > 0 else r.get("fund_utilization_rate")

        score = r.get("risk_score") if r.get("risk_score") is not None else 65
        tier = r.get("risk_tier") or ("CRITICAL" if score >= 75 else "HIGH" if score >= 50 else "MEDIUM" if score >= 25 else "LOW")
        sc_st = sc_st_map.get(str(c.id))

        data.append({
            "id": str(c.id), "name": c.name, "state": c.state, "district": c.district,
            "mp_name": c.mp_name, "risk_score": score,
            "risk_tier": tier, "total_works": tot_works,
            "total_expenditure": tot_exp,
            "total_funds_released": tot_rel,
            "fund_utilization_rate": util_rate,
            "active_anomalies": anomaly_counts.get(str(c.id), 0),
            "financial_year": r.get("financial_year") or fy,
            "sc_st_compliance_status": sc_st.status if sc_st else "COMPLIANT",
            "sc_pct_actual": float(sc_st.sc_pct_actual) if sc_st else 0.0,
            "st_pct_actual": float(sc_st.st_pct_actual) if sc_st else 0.0,
            "sc_pct_target": float(sc_st.sc_pct_target) if sc_st else float(c.sc_allocation_target_pct or 15.0),
            "st_pct_target": float(sc_st.st_pct_target) if sc_st else float(c.st_allocation_target_pct or 7.5),
        })
    return {"data": data, "pagination": Pagination(page=page, per_page=per_page,
                                                   total_records=total,
                                                   total_pages=(total + per_page - 1) // per_page)}


@router.get("/{constituency_id}")
async def get_constituency(
    constituency_id: str,
    financial_year: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                      ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
):
    from app.services.analytics import constituency_detail
    result = await constituency_detail(db, user, constituency_id, fy=financial_year)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={
            "code": "NOT_FOUND", "message": "Constituency not found"})
    return result
