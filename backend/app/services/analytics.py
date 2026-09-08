"""Analytics query layer (FR-DVZ-001/002, FR-API-001 analytics endpoints)."""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import scope_constituency_filter
from app.models import (
    ANOMALY_CATEGORY_MAP,
    Anomaly,
    Constituency,
    ConstituencyRiskScore,
    FundRelease,
    User,
    Work,
)

ACTIVE_STATUSES = ("NEW", "ACKNOWLEDGED", "UNDER_REVIEW")


import uuid


def _to_uuids(ids: list | None) -> list | None:
    if ids is None:
        return None
    res = []
    for i in ids:
        if isinstance(i, str):
            try:
                res.append(uuid.UUID(i))
            except Exception:
                res.append(i)
        else:
            res.append(i)
    return res


async def _visible_constituency_ids(db: AsyncSession, user: User) -> list | None:
    return await scope_constituency_filter(db, user)


async def latest_fy(db: AsyncSession) -> str | None:
    return (await db.execute(select(func.max(ConstituencyRiskScore.financial_year)))).scalar()


def _serialize_constituency(c: Constituency) -> dict:
    return {
        "id": str(c.id), "name": c.name, "state": c.state, "district": c.district,
        "mp_name": c.mp_name, "mp_type": c.mp_type,
    }


async def _risk_rows(db: AsyncSession, ids: list | None, fy: str | None) -> list[dict]:
    q = select(ConstituencyRiskScore, Constituency).join(
        Constituency, Constituency.id == ConstituencyRiskScore.constituency_id)
    if ids is not None:
        uids = _to_uuids(ids)
        if not uids:
            return []
        q = q.where(ConstituencyRiskScore.constituency_id.in_(uids))
    if fy:
        q = q.where(ConstituencyRiskScore.financial_year == fy)
    rows = (await db.execute(q)).all()
    out = []
    for rs, c in rows:
        out.append({
            "id": str(c.id), "name": c.name, "state": c.state, "district": c.district,
            "mp_name": c.mp_name, "financial_year": rs.financial_year,
            "risk_score": rs.risk_score, "risk_tier": rs.risk_tier,
            "total_works": rs.total_works, "high_risk_works": rs.high_risk_works,
            "fund_utilization_rate": float(rs.fund_utilization_rate) if rs.fund_utilization_rate is not None else None,
            "total_funds_released": float(rs.total_funds_released or 0),
            "total_expenditure": float(rs.total_expenditure or 0),
        })
    return out


async def _anomaly_rows(db: AsyncSession, ids: list | None, limit: int = 500) -> list[Anomaly]:
    q = select(Anomaly).order_by(Anomaly.detected_at.desc()).limit(limit)
    if ids is not None:
        uids = _to_uuids(ids)
        if not uids:
            return []
        q = q.where(Anomaly.constituency_id.in_(uids))
    return list((await db.execute(q)).scalars().all())


async def national_summary(db: AsyncSession, user: User) -> dict:
    ids = await _visible_constituency_ids(db, user)
    uids = _to_uuids(ids)
    fy = await latest_fy(db)

    total_works = 0
    total_expenditure = 0.0
    exp_expr = func.coalesce(func.sum(Work.actual_expenditure), 0)
    if uids is None:
        total_works = (await db.execute(select(func.count(Work.id)))).scalar() or 0
        total_expenditure = float((await db.execute(select(exp_expr))).scalar() or 0)
    else:
        q = select(func.count(Work.id), exp_expr)
        if uids:
            q = q.where(Work.constituency_id.in_(uids))
        else:
            q = q.where(False)
        total_works, total_expenditure = (await db.execute(q)).one()
        total_expenditure = float(total_expenditure)

    risk_rows = await _risk_rows(db, ids, fy)

    # active anomaly counts using SQL
    active_q = select(func.count(Anomaly.id)).where(Anomaly.status.in_(ACTIVE_STATUSES))
    type_counts_q = select(Anomaly.anomaly_type, func.count(Anomaly.id)).where(
        Anomaly.status.in_(ACTIVE_STATUSES)).group_by(Anomaly.anomaly_type)
        
    if uids is not None:
        if uids:
            active_q = active_q.where(Anomaly.constituency_id.in_(uids))
            type_counts_q = type_counts_q.where(Anomaly.constituency_id.in_(uids))
        else:
            active_q = active_q.where(False)
            type_counts_q = type_counts_q.where(False)

    active_total = (await db.execute(active_q)).scalar() or 0
    type_counts_rows = (await db.execute(type_counts_q)).all()
    type_counts = {r[0]: r[1] for r in type_counts_rows}

    high_risk = [r for r in risk_rows if r["risk_tier"] in ("HIGH", "CRITICAL")]

    # risk distribution
    risk_dist = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r in risk_rows:
        risk_dist[r["risk_tier"]] += 1

    # anomaly distribution by category
    cat_dist = defaultdict(int)
    for atype, cnt in type_counts.items():
        cat_dist[ANOMALY_CATEGORY_MAP.get(atype, "PATTERN_ANOMALY")] += cnt

    # trends by FY
    trends = await anomaly_trends(db, ids)

    # state summaries (latest FY)
    consts_all = (await db.execute(select(Constituency))).scalars().all()
    cid_to_state = {str(c.id): c.state for c in consts_all}

    state_map: dict[str, dict] = {}
    if risk_rows:
        for r in risk_rows:
            s = state_map.setdefault(r["state"], {
                "state": r["state"], "avg_risk": 0, "constituencies": 0, "works": 0,
                "expenditure_cr": 0.0, "released_cr": 0.0, "high_risk": 0, "anomalies": 0,
            })
            s["constituencies"] += 1
            s["works"] += r["total_works"]
            s["expenditure_cr"] += r["total_expenditure"] / 1e7
            s["released_cr"] += r["total_funds_released"] / 1e7
            s["avg_risk"] += r["risk_score"]
            s["high_risk"] += 1 if r["risk_tier"] in ("HIGH", "CRITICAL") else 0
        # count anomalies per state via SQL
        state_anomalies_q = select(Constituency.state, func.count(Anomaly.id)).join(
            Constituency, Constituency.id == Anomaly.constituency_id
        ).where(Anomaly.status.in_(ACTIVE_STATUSES)).group_by(Constituency.state)
        
        if uids is not None:
            if uids:
                state_anomalies_q = state_anomalies_q.where(Anomaly.constituency_id.in_(uids))
            else:
                state_anomalies_q = state_anomalies_q.where(False)
                
        state_anom_counts = dict((await db.execute(state_anomalies_q)).all())
        
        for s in state_map.values():
            s["avg_risk"] = round(s["avg_risk"] / s["constituencies"], 1) if s["constituencies"] else 0
            s["anomalies"] = state_anom_counts.get(s["state"], 0)
    else:
        cq = select(Constituency)
        if uids is not None:
            if uids:
                cq = cq.where(Constituency.id.in_(uids))
            else:
                cq = cq.where(False)
        consts = (await db.execute(cq)).scalars().all()
        for c in consts:
            s = state_map.setdefault(c.state, {
                "state": c.state, "avg_risk": 0, "constituencies": 0, "works": 0,
                "expenditure_cr": 0.0, "released_cr": 0.0, "high_risk": 0, "anomalies": 0,
            })
            s["constituencies"] += 1

    top_risky = sorted(risk_rows, key=lambda r: r["risk_score"], reverse=True)[:10]

    recent = []
    recent_anomalies = await _anomaly_rows(db, ids, limit=20)
    for a in recent_anomalies:
        if a.status in ACTIVE_STATUSES:
            recent.append(await _anomaly_dict(db, a))

    return {
        "kpis": [
            {"key": "total_works", "label": "Total Works Analyzed", "value": total_works, "format": "int"},
            {"key": "total_expenditure", "label": "Total Expenditure", "value": round(total_expenditure / 1e7, 2), "format": "cr"},
            {"key": "anomalies_detected", "label": "Active Anomalies", "value": active_total, "format": "int"},
            {"key": "high_risk_constituencies", "label": "High-Risk Constituencies", "value": len(high_risk), "format": "int"},
        ],
        "risk_distribution": risk_dist,
        "anomaly_distribution": {k: v for k, v in cat_dist.items()},
        "anomaly_type_distribution": dict(type_counts),
        "top_risky_constituencies": top_risky,
        "trends": trends,
        "state_summaries": sorted(state_map.values(), key=lambda s: -s["avg_risk"]),
        "recent_alerts": recent,
        "financial_year": fy,
    }


def _anomaly_state(a: Anomaly) -> str:
    d = a.details or {}
    return d.get("state") or d.get("constituency_state") or ""


async def _anomaly_dict(db: AsyncSession, a: Anomaly) -> dict:
    c = (await db.execute(select(Constituency).where(Constituency.id == a.constituency_id))).scalar_one_or_none()
    work_ref = None
    if a.work_id:
        w = (await db.execute(select(Work).where(Work.id == a.work_id))).scalar_one_or_none()
        if w:
            work_ref = w.work_id
    d = dict(a.details or {})
    d.pop("state", None)
    return {
        "id": str(a.id), "work_id": str(a.work_id) if a.work_id else None, "work_ref": work_ref,
        "constituency_id": str(a.constituency_id),
        "constituency_name": c.name if c else None,
        "state": c.state if c else None,
        "anomaly_type": a.anomaly_type,
        "category": ANOMALY_CATEGORY_MAP.get(a.anomaly_type, "PATTERN_ANOMALY"),
        "severity": a.severity, "confidence_score": float(a.confidence_score),
        "detection_method": a.detection_method, "details": d,
        "status": a.status, "note": a.note,
        "detected_at": a.detected_at.isoformat(),
    }


async def anomaly_trends(db: AsyncSession, ids: list | None) -> list[dict]:
    """Anomaly counts per financial year per category."""
    uids = _to_uuids(ids)
    anomalies = await _anomaly_rows(db, uids, limit=5000)
    work_fy: dict[str, str] = {}
    if anomalies:
        wq = select(Work.id, Work.financial_year)
        if uids:
            wq = wq.where(Work.constituency_id.in_(uids))
        for wid, fy in (await db.execute(wq)).all():
            work_fy[str(wid)] = fy

    fy_map: dict[str, dict] = defaultdict(lambda: defaultdict(int))
    for a in anomalies:
        fy = None
        if a.work_id and str(a.work_id) in work_fy:
            fy = work_fy[str(a.work_id)]
        elif a.details and a.details.get("financial_year"):
            fy = a.details["financial_year"]
        if not fy:
            continue
        cat = ANOMALY_CATEGORY_MAP.get(a.anomaly_type, "PATTERN_ANOMALY")
        fy_map[fy][cat] += 1
        fy_map[fy]["_total"] += 1

    out = []
    for fy in sorted(fy_map.keys()):
        row = {"financial_year": fy, "total": fy_map[fy]["_total"]}
        for cat in ("COST_OVERRUN", "DUPLICATE_WORK", "DELAYED_PROJECT", "FUND_MISUTILIZATION", "PATTERN_ANOMALY"):
            row[cat] = fy_map[fy][cat]
        out.append(row)
    return out


async def state_summary(db: AsyncSession, user: User, state: str) -> dict:
    ids = await _visible_constituency_ids(db, user)
    uids = _to_uuids(ids)
    # resolve state's constituency ids
    q = select(Constituency).where(Constituency.state == state)
    consts = list((await db.execute(q)).scalars().all())
    state_ids = [c.id for c in consts]
    if uids is not None:
        visible_set = set(uids)
        state_ids = [i for i in state_ids if i in visible_set]
    if not state_ids:
        return {"state": state, "constituencies": [], "kpis": [], "trends": []}
    fy = await latest_fy(db)
    risk_rows = await _risk_rows(db, state_ids, fy)
    anomalies = [a for a in await _anomaly_rows(db, state_ids)
                 if a.status in ACTIVE_STATUSES]
    trends = await anomaly_trends(db, state_ids)
    return {
        "state": state,
        "kpis": [
            {"key": "constituencies", "label": "Constituencies", "value": len(risk_rows), "format": "int"},
            {"key": "works", "label": "Total Works", "value": sum(r["total_works"] for r in risk_rows), "format": "int"},
            {"key": "expenditure", "label": "Total Expenditure (₹ Cr)", "value": round(sum(r["total_expenditure"] for r in risk_rows) / 1e7, 2), "format": "cr"},
            {"key": "anomalies", "label": "Active Anomalies", "value": len(anomalies), "format": "int"},
        ],
        "constituencies": risk_rows,
        "trends": trends,
    }


async def constituency_detail(db: AsyncSession, user: User, cid: str | uuid.UUID, fy: str | None = None) -> dict | None:
    try:
        cid_val = uuid.UUID(str(cid))
    except (ValueError, TypeError):
        cid_val = cid
    c = (await db.execute(select(Constituency).where(Constituency.id == cid_val))).scalar_one_or_none()
    if c is None:
        return None
    from app.auth.rbac import ensure_scoped
    ensure_scoped(user, c)

    if not fy:
        fy = await latest_fy(db)

    risk_rows = await _risk_rows(db, [c.id], fy)
    risk = risk_rows[0] if risk_rows else {}

    works_q = select(Work).where(Work.constituency_id == c.id)
    if fy:
        works_q = works_q.where(Work.financial_year == fy)
    works = list((await db.execute(works_q)).scalars().all())

    anomalies_all = await _anomaly_rows(db, [c.id], limit=2000)
    work_ids_set = {w.id for w in works}
    # Filter anomalies relevant to this constituency and active
    anomalies = [a for a in anomalies_all
                 if a.status in ACTIVE_STATUSES and (not a.work_id or a.work_id in work_ids_set)]

    # KPIs
    total_works = len(works)
    total_sanctioned = sum(float(w.sanctioned_amount) for w in works)
    total_exp = sum(float(w.actual_expenditure or 0) for w in works)
    rel_q = select(FundRelease).where(FundRelease.constituency_id == c.id)
    if fy:
        rel_q = rel_q.where(FundRelease.financial_year == fy)
    released = float(sum(float(r.amount_released) for r in (
        await db.execute(rel_q)).scalars().all()))
    utilization = (total_exp / released * 100.0) if released else None

    # risk components average (covers all 6 Target Risk Dimensions + legacy keys)
    comp_avg = {
        "cost_risk": 0.0,
        "delay_risk": 0.0,
        "payment_risk": 0.0,
        "duplicate_risk": 0.0,
        "compliance_risk": 0.0,
        "durability_risk": 0.0,
        "cost_overrun": 0.0,
        "delay": 0.0,
        "duplicate": 0.0,
        "pattern": 0.0,
        "fund_utilization": 0.0,
    }
    if works:
        for w in works:
            rc = w.risk_components or {}
            for k in comp_avg:
                comp_avg[k] += float(rc.get(k, 0))
        for k in comp_avg:
            comp_avg[k] = round(comp_avg[k] / len(works), 1)

    # duplicate pairs
    dup_pairs = []
    from app.models import DuplicatePair
    pair_rows = (await db.execute(
        select(DuplicatePair).where(
            (DuplicatePair.work_id_a.in_([w.id for w in works])) |
            (DuplicatePair.work_id_b.in_([w.id for w in works]))
        ))).scalars().all()
    wmap = {str(w.id): w for w in works}
    for p in pair_rows:
        wa = wmap.get(str(p.work_id_a)); wb = wmap.get(str(p.work_id_b))
        if not wa or not wb:
            continue
        dup_pairs.append({
            "work_a_ref": wa.work_id, "work_b_ref": wb.work_id,
            "work_a_description": wa.work_description, "work_b_description": wb.work_description,
            "text_similarity": float(p.text_similarity),
            "amount_similarity": float(p.amount_similarity),
            "composite_score": p.composite_score,
            "severity": "HIGH" if p.composite_score >= 70 else "MEDIUM",
            "detected_at": p.detected_at.isoformat(),
        })

    # Financial reconciliation: Releases vs Expenditure by financial year
    timeline = []
    releases_by_fy = defaultdict(float)
    for r in (await db.execute(select(FundRelease).where(FundRelease.constituency_id == c.id))).scalars().all():
        releases_by_fy[r.financial_year] += float(r.amount_released or 0)

    exp_by_fy = defaultdict(float)
    for w_all in (await db.execute(select(Work).where(Work.constituency_id == c.id))).scalars().all():
        exp_by_fy[w_all.financial_year] += float(w_all.actual_expenditure or 0)

    all_fys = sorted(set(list(releases_by_fy.keys()) + list(exp_by_fy.keys())))
    for f in all_fys:
        rel = releases_by_fy[f]
        exp = exp_by_fy[f]
        rate = round(exp / rel * 100.0, 1) if rel > 0 else None
        timeline.append({
            "financial_year": f,
            "released": rel,
            "expenditure": exp,
            "fund_utilization_rate": rate,
        })

    return {
        "constituency": _serialize_constituency(c),
        "kpis": [
            {"key": "works", "label": "Total Works Sanctioned", "value": total_works, "format": "int"},
            {"key": "released", "label": "Total Funds Released (₹ Cr)", "value": round(released / 1e7, 2), "format": "cr"},
            {"key": "utilization", "label": "Fund Utilization Rate (%)", "value": round(utilization, 1) if utilization is not None else None, "format": "pct"},
            {"key": "risk", "label": "Risk Score", "value": risk.get("risk_score"), "format": "risk", "tier": risk.get("risk_tier")},
            {"key": "anomalies", "label": "Active Anomalies", "value": len(anomalies), "format": "int"},
        ],
        "risk": risk,
        "risk_components_avg": comp_avg,
        "works": [{
            "id": str(w.id), "work_id": w.work_id, "work_description": w.work_description,
            "work_category": w.work_category, "sanctioned_amount": float(w.sanctioned_amount),
            "actual_expenditure": float(w.actual_expenditure or 0),
            "cost_overrun_percentage": float(w.cost_overrun_percentage or 0),
            "work_status": w.work_status, "financial_year": w.financial_year,
            "sanction_date": w.sanction_date.isoformat(),
            "expected_completion_date": w.expected_completion_date.isoformat() if w.expected_completion_date else None,
            "completion_date": w.completion_date.isoformat() if w.completion_date else None,
            "implementing_agency": w.implementing_agency,
            "risk_score": w.risk_score, "risk_tier": w.risk_tier,
            "risk_components": w.risk_components,
            "anomaly_flags": [a.anomaly_type for a in anomalies if a.work_id == w.id],
            "delay_days": _work_delay_days(w),
        } for w in works],
        "duplicate_pairs": dup_pairs,
        "anomalies": [await _anomaly_dict(db, a) for a in sorted(anomalies, key=lambda x: x.detected_at, reverse=True)],
        "expenditure_timeline": timeline,
        "financial_year": fy,
    }


def _work_delay_days(w: Work) -> int | None:
    from datetime import date as _date
    ref = _date.today()
    if w.work_status in ("SANCTIONED", "IN_PROGRESS", "ON_HOLD") and w.expected_completion_date:
        if ref > w.expected_completion_date:
            return (ref - w.expected_completion_date).days
    if w.work_status == "COMPLETED" and w.completion_date and w.expected_completion_date:
        if w.completion_date > w.expected_completion_date:
            return (w.completion_date - w.expected_completion_date).days
    return None


def _estimated_monthly_expenditure(works: list[Work]) -> list[dict]:
    """Linear monthly spread of actual expenditure (estimated, for visualization)."""
    monthly: dict[str, dict] = defaultdict(lambda: defaultdict(float))
    for w in works:
        start = w.sanction_date
        end = w.completion_date or w.expected_completion_date or start
        if end < start:
            end = start
        months = max(1, (end.year - start.year) * 12 + (end.month - start.month) + 1)
        amt = float(w.actual_expenditure or 0) / months
        y, m = start.year, start.month
        for _ in range(months):
            key = f"{y}-{m:02d}"
            monthly[key][w.work_category] += amt
            m += 1
            if m > 12:
                m = 1; y += 1
    out = []
    for key in sorted(monthly.keys()):
        row = {"month": key}
        row.update({k: round(v, 2) for k, v in monthly[key].items()})
        out.append(row)
    return out
