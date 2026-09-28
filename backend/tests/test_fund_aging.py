"""Unit tests for Unspent Fund / Aging Tracker (Q1.6).

Verifies:
1. A work with actual_expenditure = 0 and sanction_date > 365 days before reference date
   is correctly flagged AGING_HIGH (Acceptance Criterion).
2. Works with > 730 days idle are flagged AGING_CRITICAL.
3. Works <= 180 days idle are not flagged.
4. aging_risk component is properly stored in work.risk_components.
5. GET /api/v1/analytics/aging returns ranked lists by unspent balance and idle days.
6. State summary includes total_unspent_balance and oldest_unspent_project_days.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.database import SyncSessionLocal
from app.models import Anomaly, Constituency, FundRelease, Work
from app.services.anomaly_detection.fund_aging import clear_fund_aging, detect_fund_aging
from app.services.risk_scoring import run_risk_scoring


@pytest.fixture
def seeded_aging_data():
    """Seeds constituency with works at various aging thresholds."""
    ref_date = date(2026, 9, 1)
    with SyncSessionLocal() as s:
        c = Constituency(
            id=uuid.uuid4(),
            name="Aging Test Constituency",
            state="Maharashtra",
            district="Pune",
            mp_name="MP Aging",
        )
        s.add(c)
        s.commit()

        # Fund release: 5 Crore
        rel = FundRelease(
            release_id="REL-AGING-01",
            constituency_id=c.id,
            financial_year="2024-2025",
            installment_number=1,
            amount_released=50000000.0,
            release_date=ref_date - timedelta(days=500),
            cumulative_release=50000000.0,
        )
        s.add(rel)

        # Work 1: > 365 days idle (400 days), actual_expenditure = 0 -> MUST BE AGING_HIGH
        w1 = Work(
            work_id="WRK-AGING-HIGH",
            constituency_id=c.id,
            work_description="Stalled Community Hall Project",
            work_category="COMMUNITY_ASSETS",
            sanctioned_amount=2000000.0,
            actual_expenditure=0.0,
            sanction_date=ref_date - timedelta(days=400),
            work_status="IN_PROGRESS",
            financial_year="2024-2025",
        )

        # Work 2: > 730 days idle (800 days) -> AGING_CRITICAL
        w2 = Work(
            work_id="WRK-AGING-CRIT",
            constituency_id=c.id,
            work_description="Abandoned Road Construction",
            work_category="ROADS",
            sanctioned_amount=5000000.0,
            actual_expenditure=0.0,
            sanction_date=ref_date - timedelta(days=800),
            work_status="SANCTIONED",
            financial_year="2023-2024",
        )

        # Work 3: Recent work (< 180 days idle, 60 days) -> NO ANOMALY
        w3 = Work(
            work_id="WRK-AGING-FRESH",
            constituency_id=c.id,
            work_description="Recently sanctioned hospital equipment",
            work_category="HEALTH",
            sanctioned_amount=3000000.0,
            actual_expenditure=0.0,
            sanction_date=ref_date - timedelta(days=60),
            work_status="SANCTIONED",
            financial_year="2024-2025",
        )

        s.add_all([w1, w2, w3])
        s.commit()
        return {"constituency_id": c.id, "ref_date": ref_date}


def test_fund_aging_acceptance_criterion(seeded_aging_data):
    """Verifies acceptance criterion: work with actual_expenditure=0 and >365d is AGING_HIGH."""
    ref_date = seeded_aging_data["ref_date"]
    with SyncSessionLocal() as s:
        clear_fund_aging(s)
        detected = detect_fund_aging(s, reference_date=ref_date)
        assert detected >= 2

        anoms = s.execute(
            select(Anomaly).where(Anomaly.anomaly_type == "FUND_AGING")
        ).scalars().all()
        by_work = {a.details["work_id"]: a for a in anoms if a.details}

        # Work 1: 400 days idle -> AGING_HIGH
        assert "WRK-AGING-HIGH" in by_work
        a_high = by_work["WRK-AGING-HIGH"]
        assert a_high.severity == "HIGH"
        assert a_high.details["days_idle"] == 400

        # Work 2: 800 days idle -> AGING_CRITICAL
        assert "WRK-AGING-CRIT" in by_work
        a_crit = by_work["WRK-AGING-CRIT"]
        assert a_crit.severity == "CRITICAL"

        # Work 3: 60 days idle -> NOT FLAGGED
        assert "WRK-AGING-FRESH" not in by_work

        # Verify risk scoring incorporates aging_risk
        run_risk_scoring(s)
        w_high = s.execute(
            select(Work).where(Work.work_id == "WRK-AGING-HIGH")
        ).scalar_one()
        assert w_high.risk_components["aging_risk"] == 75


async def test_fund_aging_api_endpoints(client, login, seeded_aging_data):
    """Tests GET /api/v1/analytics/aging and state-summary aging fields."""
    ref_date = seeded_aging_data["ref_date"]
    with SyncSessionLocal() as s:
        clear_fund_aging(s)
        detect_fund_aging(s, reference_date=ref_date)
        run_risk_scoring(s)

    # 1. Test GET /api/v1/analytics/aging
    res = await client.get("/api/v1/analytics/aging?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "total_unspent_balance" in data
    assert "ranked_by_unspent_balance" in data
    assert "ranked_by_idle_days" in data
    assert len(data["ranked_by_idle_days"]) >= 1
    assert data["ranked_by_idle_days"][0]["max_project_days_unspent"] >= 400

    # 2. Test GET /api/v1/analytics/state-summary/Maharashtra
    res_state = await client.get("/api/v1/analytics/state-summary/Maharashtra")
    assert res_state.status_code == 200
    s_data = res_state.json()
    assert "total_unspent_balance" in s_data
    assert "oldest_unspent_project_days" in s_data
    assert s_data["oldest_unspent_project_days"] >= 400
