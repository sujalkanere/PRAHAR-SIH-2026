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
    if consts:
        cids = [c.id for c in consts]
        rows = (await db.execute(
            select(Anomaly.constituency_id, func.count(Anomaly.id))
            .where(Anomaly.constituency_id.in_(cids),
                   Anomaly.status.in_(("NEW", "ACKNOWLEDGED", "UNDER_REVIEW")))
            .group_by(Anomaly.constituency_id))).all()
        anomaly_counts = {str(cid): n for cid, n in rows}

    data = []
    for c in consts:
        r = risk_map.get(str(c.id), {})
        data.append({
            "id": str(c.id), "name": c.name, "state": c.state, "district": c.district,
            "mp_name": c.mp_name, "risk_score": r.get("risk_score"),
            "risk_tier": r.get("risk_tier"), "total_works": r.get("total_works", 0),
            "total_expenditure": r.get("total_expenditure", 0),
            "total_funds_released": r.get("total_funds_released", 0),
            "fund_utilization_rate": r.get("fund_utilization_rate"),
            "active_anomalies": anomaly_counts.get(str(c.id), 0),
            "financial_year": r.get("financial_year"),
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
