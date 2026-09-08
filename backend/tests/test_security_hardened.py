"""
Golden tests for security hardening:
- Fail-closed RBAC: ensure scoped user without valid scope_value is denied (403)
- Ensure settings validation (external explanation disabled by default, dev_demo setting exists)
"""

import uuid
import pytest
from fastapi import HTTPException
from app.auth.rbac import ensure_scoped, scope_constituency_filter, ROLE_DISTRICT, ROLE_STATE_NODAL, ROLE_MP, ROLE_ADMIN
from app.models import User, Constituency
from app.config import get_settings


def test_ensure_scoped_denies_missing_scope_value():
    user_no_scope = User(
        id=uuid.uuid4(),
        username="unscoped_dist",
        role=ROLE_DISTRICT,
        password_hash="dummy",
        scope_type="DISTRICT",
        scope_value=None,  # Missing scope
    )
    constituency = Constituency(
        id=uuid.uuid4(),
        name="Pune",
        district="Pune",
        state="Maharashtra",
    )

    # Must raise HTTPException 403
    with pytest.raises(HTTPException) as exc_info:
        ensure_scoped(user_no_scope, constituency)
    assert exc_info.value.status_code == 403
    assert "not configured" in exc_info.value.detail["message"].lower()


def test_ensure_scoped_denies_mismatched_district():
    user = User(
        id=uuid.uuid4(),
        username="pune_dist",
        role=ROLE_DISTRICT,
        password_hash="dummy",
        scope_type="DISTRICT",
        scope_value="Pune",
    )
    mismatched_const = Constituency(
        id=uuid.uuid4(),
        name="Nagpur",
        district="Nagpur",
        state="Maharashtra",
    )

    with pytest.raises(HTTPException) as exc_info:
        ensure_scoped(user, mismatched_const)
    assert exc_info.value.status_code == 403


def test_ensure_scoped_allows_matching_district():
    user = User(
        id=uuid.uuid4(),
        username="pune_dist",
        role=ROLE_DISTRICT,
        password_hash="dummy",
        scope_type="DISTRICT",
        scope_value="Pune",
    )
    matching_const = Constituency(
        id=uuid.uuid4(),
        name="Pune",
        district="Pune",
        state="Maharashtra",
    )
    # Should not raise
    ensure_scoped(user, matching_const)


def test_ensure_scoped_allows_admin():
    admin_user = User(
        id=uuid.uuid4(),
        username="superadmin",
        role=ROLE_ADMIN,
        password_hash="dummy",
    )
    any_const = Constituency(
        id=uuid.uuid4(),
        name="Anywhere",
        district="Anywhere",
        state="Anywhere",
    )
    # Admin is never denied
    ensure_scoped(admin_user, any_const)


def test_settings_security_defaults():
    settings = get_settings()
    # External explanation must be false by default
    assert settings.external_explanation_enabled is False
    # Dev demo must be a boolean attribute
    assert isinstance(settings.dev_demo, bool)
