"""RBAC tests (SRS §3.1 FR-AAA-003, §7.2 T-RB-*)."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Constituency, Work


async def _seed_constituencies():
    """Creates constituencies for Maharashtra/Pune + Bihar/Begusarai."""
    from app.models import Constituency

    async with AsyncSessionLocal() as db:
        db.add_all([
            Constituency(name="Pune", state="Maharashtra", district="Pune", mp_name="Rohit Pawar"),
            Constituency(name="Nashik", state="Maharashtra", district="Nashik", mp_name="Godavari Patil"),
            Constituency(name="Begusarai", state="Bihar", district="Begusarai", mp_name="Kanhaiya Kumar"),
        ])
        await db.commit()
        rows = (await db.execute(select(Constituency))).scalars().all()
        return {c.name: c for c in rows}


async def test_admin_sees_all_constituencies(client, login):
    await _seed_constituencies()
    h = await login("admin", "Admin@1234")
    r = await client.get("/api/v1/constituencies", headers=h)
    assert r.status_code == 200
    assert r.json()["pagination"]["total_records"] == 3


async def test_state_user_sees_only_own_state(client, login):
    await _seed_constituencies()
    h = await login("state_user", "State@1234")
    r = await client.get("/api/v1/constituencies", headers=h)
    assert r.status_code == 200
    names = {c["name"] for c in r.json()["data"]}
    assert names == {"Pune", "Nashik"}


async def test_district_user_sees_only_own_district(client, login):
    await _seed_constituencies()
    h = await login("district_user", "District@1234")
    r = await client.get("/api/v1/constituencies", headers=h)
    names = {c["name"] for c in r.json()["data"]}
    assert names == {"Pune"}


async def test_mp_user_sees_only_own_constituency(client, login):
    await _seed_constituencies()
    h = await login("mp_user", "Mp@12345")
    r = await client.get("/api/v1/constituencies", headers=h)
    names = {c["name"] for c in r.json()["data"]}
    assert names == {"Pune"}


async def test_mp_gets_403_on_other_constituency(client, login):
    consts = await _seed_constituencies()
    h = await login("mp_user", "Mp@12345")
    other = consts["Begusarai"].id
    r = await client.get(f"/api/v1/constituencies/{other}", headers=h)
    assert r.status_code == 403


async def test_public_user_no_work_level_access(client, login):
    await _seed_constituencies()
    h = await login("public_user", "Public@1234")
    assert (await client.get("/api/v1/works", headers=h)).status_code == 403
    assert (await client.get("/api/v1/constituencies", headers=h)).status_code == 403
    # aggregate dashboard allowed
    assert (await client.get("/api/v1/analytics/national-summary", headers=h)).status_code == 200


async def test_admin_only_upload_endpoint(client, login):
    h = await login("ministry_user", "Ministry@1234")
    r = await client.post("/api/v1/admin/generate-synthetic", headers=h,
                          json={"num_constituencies": 2, "num_works_per_constituency": 5})
    assert r.status_code == 403


async def test_state_user_cannot_patch_anomaly_outside_scope(client, login, sync_session):
    consts = await _seed_constituencies()
    # create an anomaly in Bihar (outside state_user scope)
    from app.models import Anomaly

    with sync_session:
        sync_session.add(Anomaly(
            constituency_id=consts["Begusarai"].id, anomaly_type="COST_OVERRUN",
            severity="HIGH", confidence_score=0.9, detection_method="THRESHOLD"))
        sync_session.commit()
        anom = sync_session.execute(select(Anomaly)).scalars().first()
        aid = anom.id
    h = await login("state_user", "State@1234")
    r = await client.patch(f"/api/v1/anomalies/{aid}", headers=h,
                           json={"status": "ACKNOWLEDGED"})
    assert r.status_code == 403


async def test_scoped_national_summary(client, login):
    await _seed_constituencies()
    h = await login("state_user", "State@1234")
    r = await client.get("/api/v1/analytics/national-summary", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert len(body["state_summaries"]) == 1
    assert body["state_summaries"][0]["state"] == "Maharashtra"
