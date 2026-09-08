"""Works endpoints (FR-API-001)."""
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import (
    ROLE_ADMIN, ROLE_DISTRICT, ROLE_MINISTRY, ROLE_MP, ROLE_STATE_NODAL,
    get_current_user, require_roles,
)
from app.database import get_db
from app.models import Anomaly, Constituency, User, Work
from app.schemas import Pagination, WorkCreateRequest, WorkListResponse, WorkOut

router = APIRouter(prefix="/api/v1/works", tags=["works"])

SORTABLE = {
    "risk_score": Work.risk_score,
    "sanctioned_amount": Work.sanctioned_amount,
    "sanction_date": Work.sanction_date,
    "cost_overrun_percentage": Work.cost_overrun_percentage,
    "actual_expenditure": Work.actual_expenditure,
}


def _work_out(w: Work, c: Constituency, flags: list[str]) -> dict:
    return {
        "id": str(w.id), "work_id": w.work_id, "constituency_id": str(w.constituency_id),
        "constituency_name": c.name, "state": c.state, "district": c.district,
        "work_description": w.work_description, "work_category": w.work_category,
        "sanctioned_amount": float(w.sanctioned_amount),
        "actual_expenditure": float(w.actual_expenditure or 0),
        "cost_overrun_percentage": float(w.cost_overrun_percentage or 0),
        "sanction_date": w.sanction_date.isoformat(),
        "expected_completion_date": w.expected_completion_date.isoformat() if w.expected_completion_date else None,
        "completion_date": w.completion_date.isoformat() if w.completion_date else None,
        "work_status": w.work_status, "implementing_agency": w.implementing_agency,
        "financial_year": w.financial_year,
        "latitude": float(w.latitude) if w.latitude is not None else None,
        "longitude": float(w.longitude) if w.longitude is not None else None,
        "risk_score": w.risk_score, "risk_tier": w.risk_tier,
        "risk_components": w.risk_components,
        "anomaly_flags": flags,
    }


@router.get("", response_model=WorkListResponse)
async def list_works(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    constituency: str | None = None,
    constituency_id: str | None = None,
    state: str | None = None,
    district: str | None = None,
    financial_year: str | None = None,
    status_: str | None = Query(None, alias="status"),
    risk_tier: str | None = None,
    category: str | None = None,
    search: str | None = None,
    sort_by: str = Query("risk_score"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL,
                                       ROLE_DISTRICT, ROLE_MP)),
):
    from app.auth.rbac import scope_constituency_filter

    ids = await scope_constituency_filter(db, user)

    q = select(Work, Constituency).join(Constituency, Constituency.id == Work.constituency_id)
    if ids is not None:
        if not ids:
            return {"data": [], "pagination": Pagination(page=page, per_page=per_page,
                                                        total_records=0, total_pages=0)}
        q = q.where(Work.constituency_id.in_(ids))
    if constituency_id:
        try:
            cid = uuid.UUID(constituency_id)
            q = q.where(Work.constituency_id == cid)
        except ValueError:
            pass
    if constituency:
        q = q.where(Constituency.name == constituency)
    if state:
        q = q.where(Constituency.state == state)
    if district:
        q = q.where(Constituency.district == district)
    if financial_year:
        q = q.where(Work.financial_year == financial_year)
    if status_:
        q = q.where(Work.work_status == status_)
    if risk_tier:
        q = q.where(Work.risk_tier == risk_tier)
    if category:
        q = q.where(Work.work_category == category)
    if search:
        q = q.where(Work.work_description.ilike(f"%{search}%"))

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    sort_col = SORTABLE.get(sort_by, Work.risk_score)
    q = q.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())
    rows = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).all()

    # anomaly flags per work
    work_ids = [w.id for w, _ in rows]
    flags: dict[str, list[str]] = {}
    if work_ids:
        anom = (await db.execute(
            select(Anomaly.work_id, Anomaly.anomaly_type).where(Anomaly.work_id.in_(work_ids)))).all()
        for wid, atype in anom:
            flags.setdefault(str(wid), []).append(atype)

    return {
        "data": [_work_out(w, c, flags.get(str(w.id), [])) for w, c in rows],
        "pagination": Pagination(page=page, per_page=per_page, total_records=total,
                                 total_pages=(total + per_page - 1) // per_page),
    }


@router.get("/{work_id}")
async def get_work(work_id: str, db: AsyncSession = Depends(get_db),
                   user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL,
                                                      ROLE_DISTRICT, ROLE_MP))):
    try:
        wid_uuid = uuid.UUID(work_id)
        cond = (Work.id == wid_uuid) | (Work.work_id == work_id)
    except (ValueError, TypeError):
        cond = (Work.work_id == work_id)
    row = (await db.execute(
        select(Work, Constituency).join(Constituency, Constituency.id == Work.constituency_id)
        .where(cond))).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={
            "code": "NOT_FOUND", "message": "Work not found"})
    w, c = row
    from app.auth.rbac import ensure_scoped
    ensure_scoped(user, c)

    anomalies = (await db.execute(
        select(Anomaly).where(Anomaly.work_id == w.id).order_by(Anomaly.detected_at.desc()))).scalars().all()

    from app.services.analytics import _anomaly_dict
    from app.services.explanations import generate_deterministic_explanation
    explanation = generate_deterministic_explanation(w, anomalies)
    return {
        "work": _work_out(w, c, [a.anomaly_type for a in anomalies]),
        "risk_score": {"score": w.risk_score, "tier": w.risk_tier, "components": w.risk_components,
                       "last_calculated": w.updated_at.isoformat() if w.updated_at else None},
        "anomalies": [await _anomaly_dict(db, a) for a in anomalies],
        "explanation": explanation,
    }


@router.get("/{work_id}/explanation")
async def get_work_explanation_endpoint(
    work_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
):
    try:
        uid = uuid.UUID(work_id)
        q = select(Work, Constituency).join(Constituency).where(Work.id == uid)
    except (ValueError, TypeError):
        q = select(Work, Constituency).join(Constituency).where(Work.work_id == work_id)
    row = (await db.execute(q)).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Work not found"})
    w, c = row
    from app.auth.rbac import ensure_scoped
    ensure_scoped(user, c)
    anomalies = list((await db.execute(select(Anomaly).where(Anomaly.work_id == w.id))).scalars().all())
    from app.services.explanations import generate_deterministic_explanation
    return generate_deterministic_explanation(w, anomalies)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_work(
    body: WorkCreateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
):
    """Creates a new sanctioned work entry directly from the web interface."""
    from app.services.embeddings import get_embedding_service
    from app.utils.audit import write_audit
    import re

    # 1. Verify Constituency
    try:
        cid_uuid = uuid.UUID(body.constituency_id)
        c_row = (await db.execute(select(Constituency).where(Constituency.id == cid_uuid))).scalar_one_or_none()
    except (ValueError, TypeError):
        c_row = (await db.execute(select(Constituency).where(Constituency.name == body.constituency_id))).scalar_one_or_none()

    if c_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": f"Constituency '{body.constituency_id}' not found"},
        )

    # 2. Scope check
    from app.auth.rbac import ensure_scoped
    ensure_scoped(user, c_row)

    # 3. Clean & Enrich Description
    raw_desc = body.work_description.strip()
    if len(raw_desc) < 10:
        desc = f"{body.work_category} development: {raw_desc} in {c_row.name}"
    else:
        desc = re.sub(r"\s+", " ", raw_desc)

    # 4. Generate unique Work ID
    work_seq = int(datetime.now().timestamp() * 1000) % 10000000
    work_id = f"W{work_seq:07d}"

    # 5. Cost Overrun calculation
    overrun = 0.0
    if body.sanctioned_amount > 0 and body.actual_expenditure > body.sanctioned_amount:
        overrun = round((body.actual_expenditure - body.sanctioned_amount) / body.sanctioned_amount * 100, 2)

    # 6. Compute MiniLM embedding vector
    embed_service = get_embedding_service()
    embeddings = embed_service.encode([desc])
    emb_vector = embeddings[0].tolist() if len(embeddings) > 0 else None

    work_obj = Work(
        id=uuid.uuid4(),
        work_id=work_id,
        constituency_id=c_row.id,
        work_description=desc,
        work_category=body.work_category.upper(),
        sanctioned_amount=body.sanctioned_amount,
        actual_expenditure=body.actual_expenditure,
        cost_overrun_percentage=overrun,
        sanction_date=body.sanction_date,
        expected_completion_date=body.expected_completion_date,
        completion_date=body.completion_date,
        work_status=body.work_status.upper(),
        implementing_agency=body.implementing_agency,
        financial_year=body.financial_year,
        latitude=body.latitude,
        longitude=body.longitude,
        description_embedding=emb_vector,
        risk_score=min(100, int(overrun * 0.8)) if overrun > 15 else 0,
        risk_tier="HIGH" if overrun >= 50 else "MEDIUM" if overrun >= 20 else "LOW",
        risk_components={"cost_overrun": min(100, int(overrun)), "delay": 0, "duplicate": 0, "pattern": 0, "fund_utilization": 0},
    )
    db.add(work_obj)
    await db.commit()
    await db.refresh(work_obj)

    # 7. Audit log
    await write_audit(
        db,
        user_id=str(user.id),
        action="CREATE_WORK",
        resource_type="work",
        resource_id=str(work_obj.id),
        new_value={
            "work_id": work_obj.work_id,
            "constituency": c_row.name,
            "amount": body.sanctioned_amount,
            "category": body.work_category,
        },
    )

    return _work_out(work_obj, c_row, [])
