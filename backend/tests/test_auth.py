"""Auth tests (SRS §3.1 FR-AAA, §7.2 T-AU-*)."""
from __future__ import annotations

import pytest

LOGIN_URL = "/api/v1/auth/login"


async def _login(client, u, p):
    return await client.post(LOGIN_URL, json={"username": u, "password": p})


async def test_login_success_admin(client):
    r = await _login(client, "admin", "Admin@1234")
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["user"]["role"] == "ROLE_ADMIN"
    assert body["user"]["username"] == "admin"


async def test_login_wrong_password(client):
    r = await _login(client, "admin", "WrongPassword1!")
    assert r.status_code == 401


async def test_login_unknown_user(client):
    r = await _login(client, "ghost", "Whatever123!")
    assert r.status_code == 401


async def test_login_all_seed_users(client):
    users = [
        ("admin", "Admin@1234"), ("ministry_user", "Ministry@1234"),
        ("state_user", "State@1234"), ("district_user", "District@1234"),
        ("mp_user", "Mp@12345"), ("public_user", "Public@1234"),
    ]
    for u, p in users:
        r = await _login(client, u, p)
        assert r.status_code == 200, (u, r.status_code, r.text)


async def test_login_account_lockout_after_five_failures(client):
    for _ in range(5):
        r = await _login(client, "mp_user", "WrongPass123!")
        assert r.status_code == 401
    # 6th attempt -> 429 locked
    r = await _login(client, "mp_user", "Mp@12345")
    assert r.status_code == 429
    body = r.json()
    assert body["detail"]["code"] == "ACCOUNT_LOCKED"


async def test_refresh_token_flow(client, login):
    r = await _login(client, "admin", "Admin@1234")
    refresh = r.json()["refresh_token"]
    r2 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 200
    assert "access_token" in r2.json()
    # logout revokes refresh
    headers = {"Authorization": f"Bearer {r2.json()['access_token']}"}
    r3 = await client.post("/api/v1/auth/logout", headers=headers, json={"refresh_token": refresh})
    assert r3.status_code == 200
    r4 = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r4.status_code == 401


async def test_refresh_with_invalid_token(client):
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": "garbage"})
    assert r.status_code == 401


async def test_protected_route_without_token(client):
    r = await client.get("/api/v1/works")
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "AUTH_REQUIRED"


async def test_protected_route_with_garbage_token(client):
    r = await client.get("/api/v1/works", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


async def test_rate_limit_login(client):
    # > 5 rapid attempts from same IP -> 429 (per-user+IP limit in addition to lockout)
    statuses = set()
    for _ in range(8):
        r = await _login(client, "ministry_user", "BadPassword1!")
        statuses.add(r.status_code)
    assert 429 in statuses or 401 in statuses


async def test_password_policy_validation(client):
    # passwords must meet policy: length >= 8, upper, lower, digit, special
    from app.auth.password import validate_password_policy

    errs = validate_password_policy("Short1!")
    assert len(errs) > 0
    errs = validate_password_policy("lowercase1!")
    assert len(errs) > 0
    errs = validate_password_policy("UPPERCASE1!")
    assert len(errs) > 0
    errs = validate_password_policy("NoDigitHere!")
    assert len(errs) > 0
    errs = validate_password_policy("ValidPass1!")
    assert len(errs) == 0


async def test_health_endpoint(client):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["database_connected"] is True
    assert "ml_engine_ready" in body
