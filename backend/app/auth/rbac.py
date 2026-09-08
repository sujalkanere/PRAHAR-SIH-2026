"""RBAC permission matrix (FR-AAA-002) and scope filtering helpers."""
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Constituency, User

bearer_scheme = HTTPBearer(auto_error=False)

# Roles
ROLE_ADMIN = "ROLE_ADMIN"
ROLE_MINISTRY = "ROLE_MINISTRY"
ROLE_STATE_NODAL = "ROLE_STATE_NODAL"
ROLE_DISTRICT = "ROLE_DISTRICT"
ROLE_MP = "ROLE_MP"
ROLE_PUBLIC = "ROLE_PUBLIC"

# Permission matrix (SRS 2.5 / FR-AAA-002)
PERMISSIONS: dict[str, dict] = {
    ROLE_ADMIN: {
        "data_scope": "ALL",
        "can_upload_data": True,
        "can_manage_users": True,
        "can_view_all_dashboards": True,
        "can_manage_alerts": True,
        "can_generate_reports": True,
        "can_configure_thresholds": True,
    },
    ROLE_MINISTRY: {
        "data_scope": "ALL",
        "can_upload_data": False,
        "can_manage_users": False,
        "can_view_all_dashboards": True,
        "can_manage_alerts": True,
        "can_generate_reports": True,
        "can_configure_thresholds": False,
    },
    ROLE_STATE_NODAL: {
        "data_scope": "STATE",
        "can_upload_data": False,
        "can_manage_users": False,
        "can_view_state_dashboard": True,
        "can_manage_alerts": True,
        "can_generate_reports": True,
    },
    ROLE_DISTRICT: {
        "data_scope": "DISTRICT",
        "can_upload_data": False,
        "can_manage_users": False,
        "can_view_district_dashboard": True,
        "can_manage_alerts": True,
        "can_generate_reports": True,
    },
    ROLE_MP: {
        "data_scope": "CONSTITUENCY",
        "can_upload_data": False,
        "can_manage_users": False,
        "can_view_constituency_dashboard": True,
        "can_manage_alerts": False,
        "can_generate_reports": True,
    },
    ROLE_PUBLIC: {
        "data_scope": "AGGREGATE",
        "can_upload_data": False,
        "can_manage_users": False,
        "can_view_public_dashboard": True,
        "can_manage_alerts": False,
        "can_generate_reports": False,
    },
}


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    from app.auth.jwt_handler import decode_token

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "Authentication required"})
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "Invalid or expired token"})
    try:
        uid = uuid.UUID(str(payload["sub"]))
    except (ValueError, TypeError):
        uid = payload["sub"]
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "User not found or inactive"})
    return user


def require_roles(*roles: str):
    """Dependency factory enforcing role membership (returns 403 otherwise)."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
                "code": "FORBIDDEN", "message": "Insufficient permissions"})
        return user

    return checker


def has_permission(user: User, permission: str) -> bool:
    return bool(PERMISSIONS.get(user.role, {}).get(permission, False))


async def scope_constituency_filter(db: AsyncSession, user: User) -> list | None:
    """Returns list of constituency IDs visible to the user, or None for full access.

    Fails closed if a scoped role has no scope_value configured.
    ROLE_PUBLIC -> no work-level access (return []).
    """
    perms = PERMISSIONS.get(user.role, {})
    scope = perms.get("data_scope")
    if scope in ("ALL",):
        return None
    if scope in ("STATE", "DISTRICT", "CONSTITUENCY"):
        if not user.scope_value or not str(user.scope_value).strip():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "User scope is not configured"}
            )
        if scope == "STATE":
            rows = (await db.execute(select(Constituency.id).where(Constituency.state == user.scope_value))).scalars().all()
            return list(rows)
        if scope == "DISTRICT":
            rows = (await db.execute(select(Constituency.id).where(Constituency.district == user.scope_value))).scalars().all()
            return list(rows)
        if scope == "CONSTITUENCY":
            rows = (await db.execute(select(Constituency.id).where(Constituency.name == user.scope_value))).scalars().all()
            return list(rows)
    return []  # AGGREGATE


def ensure_scoped(user: User, constituency: Constituency) -> None:
    """403 if the constituency falls outside the user's scope or user scope is unconfigured."""
    perms = PERMISSIONS.get(user.role, {})
    scope = perms.get("data_scope")
    if scope == "ALL":
        return
    if scope in ("STATE", "DISTRICT", "CONSTITUENCY"):
        if not user.scope_value or not str(user.scope_value).strip():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "User scope is not configured"}
            )
        if scope == "STATE" and constituency.state == user.scope_value:
            return
        if scope == "DISTRICT" and constituency.district == user.scope_value:
            return
        if scope == "CONSTITUENCY" and constituency.name == user.scope_value:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={
        "code": "FORBIDDEN", "message": "Insufficient permissions for this scope"})
