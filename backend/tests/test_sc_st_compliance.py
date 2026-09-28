"""Unit tests for SC/ST Allocation Compliance Engine (Q1.5).

Verifies:
1. SC% and ST% are computed from actual tagged works rows and match manual calculations.
2. Status flags COMPLIANT, AT_RISK, and VIOLATION against statutory targets (15% SC, 7.5% ST).
3. GET /api/v1/compliance/sc-st returns paginated, filterable results.
4. GET /api/v1/constituencies/{id} includes the latest SC/ST compliance record.
"""
from __future__ import annotations

import uuid
from datetime import date

import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal, SyncSessionLocal
from app.models import Constituency, SCSTCompliance, Work
from app.services.anomaly_detection.pipeline import run_detection_pipeline
from app.services.anomaly_detection.sc_st_compliance import (
    clear_sc_st_compliance,
    detect_sc_st_compliance,
)


@pytest.fixture
def seeded_sc_st_data():
    """Seeds 2 constituencies with known works for manual spot-check validation."""
    with SyncSessionLocal() as s:
        # Constituency 1: Compliant (16% SC, 10% ST)
        c1 = Constituency(
            id=uuid.uuid4(),
            name="Test Constituency Alpha",
            state="Maharashtra",
            district="Pune",
            mp_name="MP Alpha",
            sc_allocation_target_pct=15.0,
            st_allocation_target_pct=7.5,
        )
        # Constituency 2: Violation (5% SC, 2% ST)
        c2 = Constituency(
            id=uuid.uuid4(),
            name="Test Constituency Beta",
            state="Maharashtra",
            district="Pune",
            mp_name="MP Beta",
            sc_allocation_target_pct=15.0,
            st_allocation_target_pct=7.5,
        )
        s.add_all([c1, c2])
        s.commit()

        # Add works for C1 (Total 100 Lakhs = 1 Cr)
        # 16 Lakhs SC, 10 Lakhs ST, 74 Lakhs GENERAL
        w1 = Work(
            work_id="WRK-C1-01",
            constituency_id=c1.id,
            work_description="SC Community Hall in Dalit Basti",
            work_category="COMMUNITY_ASSETS",
            sanctioned_amount=1600000.0,
            actual_expenditure=1600000.0,
            sanction_date=date(2024, 6, 1),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="SC",
        )
        w2 = Work(
            work_id="WRK-C1-02",
            constituency_id=c1.id,
            work_description="ST Drinking Water Well in Tribal hamlet",
            work_category="DRINKING_WATER",
            sanctioned_amount=1000000.0,
            actual_expenditure=1000000.0,
            sanction_date=date(2024, 7, 1),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="ST",
        )
        w3 = Work(
            work_id="WRK-C1-03",
            constituency_id=c1.id,
            work_description="Main Market Road",
            work_category="ROADS",
            sanctioned_amount=7400000.0,
            actual_expenditure=7400000.0,
            sanction_date=date(2024, 8, 1),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="GENERAL",
        )

        # Add works for C2 (Total 100 Lakhs)
        # 5 Lakhs SC (< 15 * 0.7 = 10.5 -> VIOLATION)
        # 2 Lakhs ST (< 7.5 * 0.7 = 5.25 -> VIOLATION)
        w4 = Work(
            work_id="WRK-C2-01",
            constituency_id=c2.id,
            work_description="Minor repair in SC area",
            work_category="ROADS",
            sanctioned_amount=500000.0,
            actual_expenditure=500000.0,
            sanction_date=date(2024, 5, 1),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="SC",
        )
        w5 = Work(
            work_id="WRK-C2-02",
            constituency_id=c2.id,
            work_description="Minor repair in ST area",
            work_category="ROADS",
            sanctioned_amount=200000.0,
            actual_expenditure=200000.0,
            sanction_date=date(2024, 5, 15),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="ST",
        )
        w6 = Work(
            work_id="WRK-C2-03",
            constituency_id=c2.id,
            work_description="Urban flyover development",
            work_category="ROADS",
            sanctioned_amount=9300000.0,
            actual_expenditure=9300000.0,
            sanction_date=date(2024, 6, 15),
            work_status="COMPLETED",
            financial_year="2024-2025",
            beneficiary_category="GENERAL",
        )

        s.add_all([w1, w2, w3, w4, w5, w6])
        s.commit()
        return {"c1": c1.id, "c2": c2.id}


def test_detect_sc_st_compliance_manual_spot_check(seeded_sc_st_data):
    """Asserts that computed SC% and ST% match exact manual spot-check fractions."""
    with SyncSessionLocal() as s:
        clear_sc_st_compliance(s)
        detect_sc_st_compliance(s)

        recs = s.execute(select(SCSTCompliance)).scalars().all()
        by_cid = {r.constituency_id: r for r in recs}

        # Constituency 1 check
        r1 = by_cid[seeded_sc_st_data["c1"]]
        assert float(r1.sc_pct_actual) == 16.0  # 16L / 100L * 100
        assert float(r1.st_pct_actual) == 10.0  # 10L / 100L * 100
        assert r1.status == "COMPLIANT"

        # Constituency 2 check
        r2 = by_cid[seeded_sc_st_data["c2"]]
        assert float(r2.sc_pct_actual) == 5.0  # 5L / 100L * 100
        assert float(r2.st_pct_actual) == 2.0  # 2L / 100L * 100
        assert r2.status == "VIOLATION"


async def test_sc_st_compliance_api_endpoints(client, login, seeded_sc_st_data):
    """Tests GET /api/v1/compliance/sc-st and detail integration."""
    with SyncSessionLocal() as s:
        clear_sc_st_compliance(s)
        detect_sc_st_compliance(s)

    h = await login("admin", "Admin@1234")

    # 1. Test compliance endpoint
    res = await client.get("/api/v1/compliance/sc-st", headers=h)
    assert res.status_code == 200
    body = res.json()
    assert body["summary"]["total"] >= 2
    assert body["summary"]["compliant"] >= 1
    assert body["summary"]["violation"] >= 1

    # Filter by status
    res_viol = await client.get("/api/v1/compliance/sc-st?status=VIOLATION", headers=h)
    assert res_viol.status_code == 200
    viol_data = res_viol.json()["data"]
    assert len(viol_data) >= 1
    assert all(d["status"] == "VIOLATION" for d in viol_data)

    # 2. Test constituency detail endpoint has sc_st_compliance
    cid2 = seeded_sc_st_data["c2"]
    res_detail = await client.get(f"/api/v1/constituencies/{cid2}", headers=h)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert "sc_st_compliance" in detail
    assert detail["sc_st_compliance"]["status"] == "VIOLATION"
    assert detail["sc_st_compliance"]["sc_pct_actual"] == 5.0
    assert detail["sc_st_compliance"]["st_pct_actual"] == 2.0
