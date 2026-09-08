"""Risk scoring tests (SRS §3.3 FR-RSE, §7.2 T-RS-*)."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Anomaly, Constituency, FundRelease, Work

REF = date(2026, 8, 31)


async def _seed(works: list[dict], anomalies: list[dict] | None = None):
    async with AsyncSessionLocal() as db:
        c = Constituency(name="Pune", state="Maharashtra", district="Pune", mp_name="MP A")
        db.add(c)
        await db.flush()
        for i, r in enumerate(works):
            sanctioned = float(r.get("amount", 100000))
            actual = float(r.get("actual", 80000)) if "actual" in r else 0.0
            overrun_pct = round(((actual - sanctioned) / sanctioned) * 100, 2) if (sanctioned > 0 and actual > sanctioned) else 0.0
            if "cost_overrun_percentage" in r:
                overrun_pct = r["cost_overrun_percentage"]
            db.add(Work(
                work_id=f"WR{i:05d}", constituency_id=c.id,
                work_description=r["desc"], work_category=r.get("category", "ROADS"),
                sanctioned_amount=sanctioned, actual_expenditure=actual,
                cost_overrun_percentage=overrun_pct,
                sanction_date=r.get("sdate", date(2024, 6, 1)),
                expected_completion_date=r.get("expected", date(2025, 6, 1)),
                completion_date=r.get("completion"), work_status=r.get("status", "COMPLETED"),
                implementing_agency=r.get("agency", "PWD"), financial_year=r.get("fy", "2024-25"),
            ))
        await db.flush()
        ws = {w.work_id: w for w in (await db.execute(select(Work))).scalars().all()}
        for a in (anomalies or []):
            db.add(Anomaly(
                constituency_id=c.id, work_id=ws[a["work_id"]].id,
                anomaly_type=a["type"], severity=a["severity"],
                confidence_score=0.9, detection_method=a.get("method", "THRESHOLD"),
                details=a.get("details", {})))
        await db.commit()
        return c.id


async def _run_risk():
    from app.services.risk_scoring import run_risk_scoring
    from app.database import SyncSessionLocal

    with SyncSessionLocal() as s:
        run_risk_scoring(s)
        s.commit()


async def _work_scores() -> dict[str, dict]:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Work.work_id, Work.risk_score, Work.risk_tier,
                                        Work.risk_components))).all()
        return {r[0]: {"score": r[1], "tier": r[2], "components": r[3]} for r in rows}


async def test_cost_overrun_component_scores():
    await _seed([
        {"desc": "A", "amount": 100000, "actual": 105000},    # 5% -> 5 pts
        {"desc": "B", "amount": 100000, "actual": 125000},    # 25% -> 15 pts
        {"desc": "C", "amount": 100000, "actual": 140000},    # 40% -> 20 pts
        {"desc": "D", "amount": 100000, "actual": 200000},    # 100% -> 25 pts
        {"desc": "E", "amount": 100000, "actual": 95000},     # none -> 0
    ])
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["components"]["cost_overrun"] == 5
    assert scores["WR00001"]["components"]["cost_overrun"] == 15
    assert scores["WR00002"]["components"]["cost_overrun"] == 20
    assert scores["WR00003"]["components"]["cost_overrun"] == 25
    assert scores["WR00004"]["components"]["cost_overrun"] == 0


async def test_delay_component_scores():
    await _seed([
        {"desc": "A", "expected": REF - timedelta(days=50), "status": "IN_PROGRESS"},
        {"desc": "B", "expected": REF - timedelta(days=120), "status": "IN_PROGRESS"},
        {"desc": "C", "expected": REF - timedelta(days=200), "status": "IN_PROGRESS"},
        {"desc": "D", "expected": REF - timedelta(days=400), "status": "IN_PROGRESS"},
        {"desc": "E", "expected": REF + timedelta(days=100), "status": "IN_PROGRESS"},
    ], anomalies=[
        {"work_id": "WR00000", "type": "DELAYED_PROJECT", "severity": "LOW", "details": {"delay_days": 50}},
        {"work_id": "WR00001", "type": "DELAYED_PROJECT", "severity": "MEDIUM", "details": {"delay_days": 120}},
        {"work_id": "WR00002", "type": "DELAYED_PROJECT", "severity": "HIGH", "details": {"delay_days": 200}},
        {"work_id": "WR00003", "type": "DELAYED_PROJECT", "severity": "CRITICAL", "details": {"delay_days": 400}},
    ])
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["components"]["delay"] == 5
    assert scores["WR00001"]["components"]["delay"] == 10
    assert scores["WR00002"]["components"]["delay"] == 20
    assert scores["WR00003"]["components"]["delay"] == 25
    assert scores["WR00004"]["components"]["delay"] == 0


async def test_duplicate_component_scores():
    await _seed([
        {"desc": "A"}, {"desc": "B"}, {"desc": "C"},
    ], anomalies=[
        {"work_id": "WR00000", "type": "DUPLICATE_WORK", "severity": "MEDIUM", "details": {"composite_score": 60}},
        {"work_id": "WR00001", "type": "DUPLICATE_WORK", "severity": "HIGH", "details": {"composite_score": 85}},
    ])
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["components"]["duplicate"] == 15
    assert scores["WR00001"]["components"]["duplicate"] == 25
    assert scores["WR00002"]["components"]["duplicate"] == 0


async def test_fund_utilization_component():
    cid = await _seed([
        {"desc": "A"}, {"desc": "B"},
    ])
    async with AsyncSessionLocal() as db:
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="LOW_UTILIZATION",
                       severity="HIGH", confidence_score=0.9, detection_method="THRESHOLD"))
        await db.commit()
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["components"]["fund_utilization"] == 10
    assert scores["WR00001"]["components"]["fund_utilization"] == 10


async def test_risk_tier_mapping():
    await _seed([
        {"desc": "A", "amount": 100000, "actual": 50000},
    ])
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["score"] == 0
    assert scores["WR00000"]["tier"] == "LOW"


async def test_constituency_score_aggregation():
    # Constituency with 10 works, 8 scoring > 50 -> high_risk_ratio = 0.8, score > 50
    # (SRS AC-RSE-001: constituency score correctly aggregates work scores)
    works = []
    for i in range(10):
        if i < 8:
            works.append({"desc": f"W{i}", "amount": 100000, "actual": 250000,
                          "expected": REF - timedelta(days=500), "status": "IN_PROGRESS"})
        else:
            works.append({"desc": f"W{i}", "amount": 100000, "actual": 90000})
    cid = await _seed(works, anomalies=[
        {"work_id": f"WR{i:05d}", "type": "COST_OVERRUN", "severity": "CRITICAL",
         "details": {"cost_overrun_percentage": 150}} for i in range(8)
    ] + [
        {"work_id": f"WR{i:05d}", "type": "DUPLICATE_WORK", "severity": "HIGH",
         "details": {"composite_score": 90}} for i in range(8)
    ] + [
        {"work_id": f"WR{i:05d}", "type": "DELAYED_PROJECT", "severity": "CRITICAL",
         "details": {"delay_days": 500}} for i in range(8)
    ])
    await _run_risk()
    async with AsyncSessionLocal() as db:
        from app.models import ConstituencyRiskScore
        row = (await db.execute(select(ConstituencyRiskScore)
                                .where(ConstituencyRiskScore.constituency_id == cid))).scalars().first()
    assert row is not None
    assert row.high_risk_works >= 5
    assert row.risk_score > 50


async def test_work_score_cap():
    # work with cost 25 + delay 25 + duplicate 25 + pattern 15 + fund 10 = 100 max
    cid = await _seed([
        {"desc": "A", "amount": 100000, "actual": 250000,
         "sdate": date(2024, 3, 15), "agency": "PWD",
         "expected": REF - timedelta(days=500), "status": "IN_PROGRESS"},
    ], anomalies=[
        {"work_id": "WR00000", "type": "COST_OVERRUN", "severity": "CRITICAL", "details": {"cost_overrun_percentage": 150}},
        {"work_id": "WR00000", "type": "DELAYED_PROJECT", "severity": "CRITICAL", "details": {"delay_days": 500}},
        {"work_id": "WR00000", "type": "DUPLICATE_WORK", "severity": "HIGH", "details": {"composite_score": 90}},
    ])
    async with AsyncSessionLocal() as db:
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="AMOUNT_CLUSTERING",
                       severity="MEDIUM", confidence_score=0.9, detection_method="RULE_BASED",
                       details={"amount": 100000.0, "work_ids": ["WR00000"]}))
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="END_OF_YEAR_RUSH",
                       severity="MEDIUM", confidence_score=0.9, detection_method="RULE_BASED", details={}))
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="ROUND_NUMBER_BIAS",
                       severity="LOW", confidence_score=0.9, detection_method="RULE_BASED", details={}))
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="AGENCY_CONCENTRATION",
                       severity="MEDIUM", confidence_score=0.9, detection_method="RULE_BASED",
                       details={"agency": "PWD"}))
        db.add(Anomaly(constituency_id=cid, work_id=None, anomaly_type="LOW_UTILIZATION",
                       severity="HIGH", confidence_score=0.9, detection_method="THRESHOLD"))
        await db.commit()
    await _run_risk()
    scores = await _work_scores()
    assert scores["WR00000"]["score"] <= 100
    assert scores["WR00000"]["score"] == 100
    assert scores["WR00000"]["tier"] == "CRITICAL"
