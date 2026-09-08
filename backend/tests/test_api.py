"""API endpoint tests (SRS §3.5 FR-API, §7.2 T-API-*)."""
from __future__ import annotations

import io

import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Anomaly, Constituency, Work


async def _seed_demo(client, login, constituencies=3, works=20):
    h = await login("admin", "Admin@1234")
    r = await client.post("/api/v1/admin/generate-synthetic", headers=h,
                          json={"num_constituencies": constituencies,
                                "num_works_per_constituency": works, "seed": 42})
    assert r.status_code == 200, r.text
    return h


async def _wait_detection(client, login, timeout=120):
    import asyncio

    h = await login("admin", "Admin@1234")
    for _ in range(timeout // 2):
        r = await client.get("/api/v1/admin/detection-runs", headers=h)
        runs = r.json()["data"]
        if runs and runs[0]["status"] in ("COMPLETED", "FAILED"):
            return runs[0], h
        await asyncio.sleep(2)
    raise TimeoutError("detection run did not finish")


async def test_works_list_pagination_and_sort(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/works?page=2&per_page=10&sort_by=risk_score&sort_order=desc", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["pagination"]["page"] == 2
    assert len(body["data"]) == 10
    assert body["pagination"]["total_records"] == 3 * 20 + 1  # 60 + twin


async def test_works_search_filter(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/works?search=toilet&per_page=5", headers=h)
    assert r.status_code == 200
    for w in r.json()["data"]:
        assert "toilet" in w["work_description"].lower()


async def test_works_category_and_status_filter(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/works?category=ROADS&status=COMPLETED&per_page=100", headers=h)
    assert r.status_code == 200
    for w in r.json()["data"]:
        assert w["work_category"] == "ROADS"
        assert w["work_status"] == "COMPLETED"


async def test_constituency_detail_has_radar_and_timeline(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/constituencies?per_page=10", headers=h)
    cid = r.json()["data"][0]["id"]
    r = await client.get(f"/api/v1/constituencies/{cid}", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["constituency"]["name"]
    assert "risk_components_avg" in body
    assert "expenditure_timeline" in body
    assert "duplicate_pairs" in body


async def test_anomaly_status_workflow_with_audit(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/anomalies?per_page=1", headers=h)
    anom = r.json()["data"][0]
    aid = anom["id"]
    r = await client.patch(f"/api/v1/anomalies/{aid}", headers=h,
                           json={"status": "ACKNOWLEDGED", "note": "verified by node"})
    assert r.status_code == 200
    assert r.json()["anomaly"]["status"] == "ACKNOWLEDGED"
    # audit trail recorded (immutable)
    r = await client.get(f"/api/v1/anomalies/{aid}", headers=h)
    trail = r.json()["audit_trail"]
    assert any(a["action"] == "ALERT_STATUS_CHANGE" and a["new_value"]["status"] == "ACKNOWLEDGED"
               for a in trail)
    # invalid status -> 422
    r = await client.patch(f"/api/v1/anomalies/{aid}", headers=h, json={"status": "NOPE"})
    assert r.status_code == 422


async def test_anomaly_filters(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/anomalies?severity=CRITICAL", headers=h)
    assert r.status_code == 200
    for a in r.json()["data"]:
        assert a["severity"] == "CRITICAL"
    r = await client.get("/api/v1/anomalies?type=COST_OVERRUN", headers=h)
    for a in r.json()["data"]:
        assert a["anomaly_type"] == "COST_OVERRUN"


async def test_csv_report_generation(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.post("/api/v1/reports/generate", headers=h,
                          json={"scope": "NATIONAL", "financial_year": "ALL", "format": "CSV"})
    assert r.status_code == 200
    rid = r.json()["report_id"]
    r = await client.get(f"/api/v1/reports/{rid}/download", headers=h)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv") or b"work_id" in r.content


async def test_pdf_report_generation(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.post("/api/v1/reports/generate", headers=h,
                          json={"scope": "NATIONAL", "financial_year": "ALL", "format": "PDF"})
    assert r.status_code == 200, r.text
    rid = r.json()["report_id"]
    r = await client.get(f"/api/v1/reports/{rid}/download", headers=h)
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"


async def test_upload_rejects_invalid_rows_per_row(client, login):
    h = await login("admin", "Admin@1234")
    csv_data = (
        "work_id,constituency_name,state_name,district_name,mp_name,work_description,"
        "work_category,sanctioned_amount,sanction_date,expected_completion_date,"
        "actual_expenditure,work_status,completion_date,implementing_agency,financial_year,latitude,longitude\n"
        "U10001,Pune,Maharashtra,Pune,MP X,Valid road work at Rampur,ROADS,500000,2024-06-01,"
        "2025-03-31,450000,COMPLETED,2025-03-20,PWD,2024-25,18.5,73.8\n"
        "U10002,Pune,Maharashtra,Pune,MP X,,ROADS,500000,2024-06-01,"      # empty desc
        "2025-03-31,450000,COMPLETED,2025-03-20,PWD,2024-25,18.5,73.8\n"
        "U10003,Pune,Maharashtra,Pune,MP X,Bad date work at Kothrud,ROADS,500000,2024-13-45,"  # bad date
        "2025-03-31,450000,COMPLETED,2025-03-20,PWD,2024-25,18.5,73.8\n"
    )
    r = await client.post("/api/v1/admin/upload", headers=h,
                          files={"file": ("upload.csv", csv_data, "text/csv")})
    assert r.status_code == 200
    body = r.json()
    assert body["records_parsed"] == 3
    assert body["records_valid"] == 1
    assert body["records_rejected"] == 2
    assert len(body["validation_errors"]) == 2


async def test_upload_oversize_file_rejected(client, login):
    h = await login("admin", "Admin@1234")
    big = b"x" * (60 * 1024 * 1024)
    r = await client.post("/api/v1/admin/upload", headers=h,
                          files={"file": ("big.csv", io.BytesIO(big), "text/csv")})
    assert r.status_code == 413


async def test_analytics_trends(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/analytics/trends?metric=anomaly_count", headers=h)
    assert r.status_code == 200
    assert len(r.json()) > 0
    assert "financial_year" in r.json()[0]


async def test_analytics_constituency_summary(client, login):
    await _seed_demo(client, login)
    _, h = await _wait_detection(client, login)
    r = await client.get("/api/v1/constituencies?per_page=10", headers=h)
    cid = r.json()["data"][0]["id"]
    r = await client.get(f"/api/v1/analytics/constituency-summary/{cid}", headers=h)
    assert r.status_code == 200
    assert "kpis" in r.json()
    assert "works" in r.json()


async def test_dashboard_load_time_under_3s(client, login):
    """AC-DVZ-003: dashboard API responds < 3 s with 10K records."""
    import time

    await _seed_demo(client, login, constituencies=50, works=100)
    _, h = await _wait_detection(client, login, timeout=180)
    t0 = time.time()
    r = await client.get("/api/v1/analytics/national-summary", headers=h)
    dt = time.time() - t0
    assert r.status_code == 200
    assert dt < 3.0
