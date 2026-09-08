"""Anomaly / alert management endpoints (FR-DVZ-003)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.rbac import (
    ROLE_ADMIN, ROLE_DISTRICT, ROLE_MINISTRY, ROLE_MP, ROLE_STATE_NODAL,
    get_current_user, require_roles,
)
from app.database import get_db
from app.models import VALID_ANOMALY_STATUSES, Anomaly, Constituency, User
from app.schemas import AnomalyOut, AnomalyUpdateRequest
from app.utils.audit import write_audit

router = APIRouter(prefix="/api/v1/anomalies", tags=["anomalies"])


@router.get("")
async def list_anomalies(
    type: str | None = Query(None, alias="type"),
    severity: str | None = None,
    status_: str | None = Query(None, alias="status"),
    constituency: str | None = None,
    state: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY, ROLE_STATE_NODAL, ROLE_DISTRICT, ROLE_MP)),
):
    from app.auth.rbac import scope_constituency_filter

    ids = await scope_constituency_filter(db, user)
    q = select(Anomaly, Constituency).join(Constituency, Constituency.id == Anomaly.constituency_id)
    if ids is not None:
        if not ids:
            return {"data": [], "pagination": {"page": page, "per_page": per_page,
                                               "total_records": 0, "total_pages": 0}}
        q = q.where(Anomaly.constituency_id.in_(ids))
    if type:
        q = q.where(Anomaly.anomaly_type == type)
    if severity:
        q = q.where(Anomaly.severity == severity)
    if status_:
        q = q.where(Anomaly.status == status_)
    if constituency:
        q = q.where(Constituency.name == constituency)
    if state:
        q = q.where(Constituency.state == state)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(Anomaly.detected_at.desc())
                             .offset((page - 1) * per_page).limit(per_page))).all()

    from app.services.analytics import _anomaly_dict
    data = [await _anomaly_dict(db, a) for a, c in rows]
    return {"data": data, "pagination": {"page": page, "per_page": per_page,
                                         "total_records": total,
                                         "total_pages": (total + per_page - 1) // per_page}}


import uuid


@router.get("/{anomaly_id}")
async def get_anomaly(anomaly_id: str, db: AsyncSession = Depends(get_db),
                      user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                                         ROLE_STATE_NODAL, ROLE_DISTRICT))):
    try:
        aid = uuid.UUID(str(anomaly_id))
    except (ValueError, TypeError):
        aid = anomaly_id
    a = (await db.execute(select(Anomaly).where(Anomaly.id == aid))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={
            "code": "NOT_FOUND", "message": "Anomaly not found"})
    c = (await db.execute(select(Constituency).where(Constituency.id == a.constituency_id))).scalar_one_or_none()
    from app.auth.rbac import ensure_scoped
    if c:
        ensure_scoped(user, c)

    from app.models import AuditLog
    audit = (await db.execute(
        select(AuditLog).where(AuditLog.resource_type == "anomaly",
                               AuditLog.resource_id == str(a.id))
        .order_by(AuditLog.timestamp.desc()))).scalars().all()

    from app.services.analytics import _anomaly_dict
    return {
        "anomaly": await _anomaly_dict(db, a),
        "audit_trail": [{
            "action": x.action, "performed_by": str(x.user_id) if x.user_id else None,
            "timestamp": x.timestamp.isoformat(), "old_value": x.old_value,
            "new_value": x.new_value, "note": (x.new_value or {}).get("note"),
        } for x in audit],
    }


@router.patch("/{anomaly_id}")
@router.patch("/{anomaly_id}/status")
async def update_anomaly(anomaly_id: str, body: AnomalyUpdateRequest,
                         request: Request, db: AsyncSession = Depends(get_db),
                         user: User = Depends(require_roles(ROLE_ADMIN, ROLE_MINISTRY,
                                                            ROLE_STATE_NODAL, ROLE_DISTRICT))):
    if body.status not in VALID_ANOMALY_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={
            "code": "VALIDATION_ERROR",
            "message": f"status must be one of {VALID_ANOMALY_STATUSES}"})

    try:
        aid = uuid.UUID(str(anomaly_id))
    except (ValueError, TypeError):
        aid = anomaly_id
    a = (await db.execute(select(Anomaly).where(Anomaly.id == aid))).scalar_one_or_none()
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={
            "code": "NOT_FOUND", "message": "Anomaly not found"})
    c = (await db.execute(select(Constituency).where(Constituency.id == a.constituency_id))).scalar_one_or_none()
    from app.auth.rbac import ensure_scoped
    if c:
        ensure_scoped(user, c)

    old_status = a.status
    a.status = body.status
    if body.note:
        a.note = body.note
    await db.commit()

    await write_audit(
        db, user_id=str(user.id), action="ALERT_STATUS_CHANGE", resource_type="anomaly",
        resource_id=str(a.id), old_value={"status": old_status},
        new_value={"status": body.status, "note": body.note},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"))

    from app.services.analytics import _anomaly_dict
    return {"anomaly": await _anomaly_dict(db, a)}
