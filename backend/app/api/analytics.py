"""Analytics endpoints (FR-API-001)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import require_roles, ROLE_ADMIN, ROLE_DISTRICT, ROLE_MINISTRY, ROLE_MP, ROLE_PUBLIC, ROLE_STATE_NODAL
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/national-summary")
async def national_summary(db: AsyncSession = Depends(get_db),
                           user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                                              ROLE_STATE_NODAL, ROLE_DISTRICT,
                                                              ROLE_MP, ROLE_PUBLIC))):
    from app.services.analytics import national_summary as ns
    return await ns(db, user)


@router.get("/state-summary/{state_name}")
@router.get("/state/{state_name}")
async def state_summary(state_name: str, db: AsyncSession = Depends(get_db),
                        user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                                           ROLE_STATE_NODAL))):
    from app.services.analytics import state_summary as ss
    return await ss(db, user, state_name)


@router.get("/constituency-summary/{constituency_id}")
async def constituency_summary(constituency_id: str, db: AsyncSession = Depends(get_db),
                               user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                                                  ROLE_STATE_NODAL, ROLE_DISTRICT,
                                                                  ROLE_MP))):
    from app.services.analytics import constituency_detail
    return await constituency_detail(db, user, constituency_id)


@router.get("/trends")
async def trends(
    metric: str = Query("anomaly_count", pattern="^(anomaly_count|avg_risk_score|fund_utilization|expenditure)$"),
    group_by: str = Query("financial_year", pattern="^(financial_year|month|quarter)$"),
    scope: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL)),
):
    from app.auth.rbac import scope_constituency_filter
    from app.models import ConstituencyRiskScore, FundRelease, Work
    from sqlalchemy import func, select

    ids = await scope_constituency_filter(db, user)
    base = select(ConstituencyRiskScore)
    if ids is not None:
        if not ids:
            return []
        base = base.where(ConstituencyRiskScore.constituency_id.in_(ids))
    if scope:
        from app.models import Constituency
        sc_ids = (await db.execute(select(Constituency.id).where(Constituency.state == scope))).scalars().all()
        base = base.where(ConstituencyRiskScore.constituency_id.in_(sc_ids))

    out: list[dict] = []
    if metric == "anomaly_count":
        from app.services.analytics import anomaly_trends
        return await anomaly_trends(db, ids)

    rows = (await db.execute(base.order_by(ConstituencyRiskScore.financial_year))).scalars().all()
    if metric == "avg_risk_score":
        agg: dict[str, list[int]] = {}
        for r in rows:
            agg.setdefault(r.financial_year, []).append(r.risk_score)
        out = [{"financial_year": fy, "value": round(sum(v) / len(v), 1)} for fy, v in sorted(agg.items())]
    elif metric == "fund_utilization":
        agg = {}
        for r in rows:
            if r.fund_utilization_rate is not None:
                agg.setdefault(r.financial_year, []).append(float(r.fund_utilization_rate))
        out = [{"financial_year": fy, "value": round(sum(v) / len(v), 1)} for fy, v in sorted(agg.items())]
    elif metric == "expenditure":
        q = select(Work.financial_year, func.coalesce(func.sum(Work.actual_expenditure), 0)).group_by(Work.financial_year)
        if ids is not None:
            if not ids:
                return []
            q = q.where(Work.constituency_id.in_(ids))
        rows2 = (await db.execute(q)).all()
        out = [{"financial_year": fy, "value": round(float(v) / 1e7, 2)} for fy, v in rows2]
    return out
