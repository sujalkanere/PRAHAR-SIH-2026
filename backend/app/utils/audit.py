"""Audit logging helpers (NFR-SEC-005). The audit_log table is INSERT-only."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    user_id: str | uuid.UUID | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    uid = uuid.UUID(str(user_id)) if user_id else None
    entry = AuditLog(
        id=uuid.uuid4(),
        user_id=uid,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
        user_agent=user_agent,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(entry)
    await db.commit()
