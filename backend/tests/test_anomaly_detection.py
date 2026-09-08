"""Anomaly detection tests (SRS §3.2 FR-ADE, §7.2 T-AD-*)."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Anomaly, Constituency, FundRelease, Work

REF = date(2026, 8, 31)


async def _seed_works(rows: list[dict]) -> dict:
    async with AsyncSessionLocal() as db:
        c = Constituency(name="Pune", state="Maharashtra", district="Pune", mp_name="MP A")
        c2 = Constituency(name="Nashik", state="Maharashtra", district="Nashik", mp_name="MP B")
        db.add_all([c, c2])
        await db.flush()
        works = []
        for i, r in enumerate(rows):
            works.append(Work(
                work_id=f"WT{i:05d}", constituency_id=c.id if r.get("constituency", "Pune") == "Pune" else c2.id,
                work_description=r["desc"], work_category=r.get("category", "ROADS"),
                sanctioned_amount=r.get("amount", 500000), actual_expenditure=r.get("actual"),
                sanction_date=r.get("sdate", date(2024, 6, 1)),
                expected_completion_date=r.get("expected"),
                completion_date=r.get("completion"), work_status=r.get("status", "COMPLETED"),
                implementing_agency=r.get("agency", "PWD"), financial_year=r.get("fy", "2024-25"),
                latitude=r.get("lat"), longitude=r.get("lon"),
            ))
        db.add_all(works)
        await db.commit()
        return {"pune": c.id, "nashik": c2.id}


async def _run_detectors():
    from app.services.anomaly_detection.cost_overrun import clear_cost_overrun, detect_cost_overrun
    from app.services.anomaly_detection.delay_detection import clear_delays, detect_delays
    from app.services.anomaly_detection.fund_utilization import (
        clear_fund_utilization, detect_fund_utilization)
    from app.services.anomaly_detection.pattern_detection import clear_patterns, detect_patterns
    from app.services.anomaly_detection.duplicate_detection import (
        clear_duplicates, detect_duplicates)
    from app.database import SyncSessionLocal

    with SyncSessionLocal() as s:
        for cl in (clear_cost_overrun, clear_delays, clear_duplicates,
                   clear_fund_utilization, clear_patterns):
            cl(s)
        detect_cost_overrun(s, REF)
        detect_delays(s, REF)
        detect_duplicates(s, REF)
        detect_fund_utilization(s, REF)
        detect_patterns(s, REF)
        s.commit()


async def _anomaly_work_ids(atype: str) -> set[str]:
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Work.work_id).join(Anomaly, Anomaly.work_id == Work.id)
            .where(Anomaly.anomaly_type == atype))).scalars().all()
        return set(rows)


# ------------------------------------------------------------------ cost overrun
async def test_cost_overrun_threshold_flagging():
    await _seed_works([
        {"desc": "Road at A", "amount": 100000, "actual": 125000},      # 25% -> flag
        {"desc": "Road at B", "amount": 100000, "actual": 150000},      # 50% -> flag
        {"desc": "Road at C", "amount": 100000, "actual": 180000},      # 80% -> flag
        {"desc": "Road at D", "amount": 100000, "actual": 105000},      # 5%  -> no flag
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("COST_OVERRUN")
    assert flagged == {"WT00000", "WT00001", "WT00002"}


async def test_cost_overrun_threshold_exact_boundary():
    await _seed_works([
        {"desc": "Road at A", "amount": 100000, "actual": 115000},   # exactly 15% -> NOT flagged
        {"desc": "Road at B", "amount": 100000, "actual": 115001},   # >15% -> flagged
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("COST_OVERRUN")
    assert flagged == {"WT00001"}


async def test_cost_overrun_severity_tiers():
    await _seed_works([
        {"desc": "Road at A", "amount": 100000, "actual": 125000},   # 25% -> MEDIUM
        {"desc": "Road at B", "amount": 100000, "actual": 140000},   # 40% -> HIGH
        {"desc": "Road at C", "amount": 100000, "actual": 200000},   # 100% -> CRITICAL
    ])
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(select(Anomaly.severity).join(Work, Work.id == Anomaly.work_id)
                                 .where(Anomaly.anomaly_type == "COST_OVERRUN")
                                 .order_by(Work.work_id))).scalars().all()
    assert rows == ["MEDIUM", "HIGH", "CRITICAL"]


# ------------------------------------------------------------------ duplicate
async def test_duplicate_detection_near_duplicate_flagged():
    # SRS AC-ADE-002-01: near-identical text -> flagged
    await _seed_works([
        {"desc": "Construction of community hall at Village Rampur",
         "amount": 500000, "actual": 450000, "sdate": date(2025, 1, 10),
         "expected": date(2025, 12, 31), "status": "IN_PROGRESS",
         "lat": 18.5, "lon": 73.8},
        {"desc": "Construction of community hall in Village Rampur",
         "amount": 505000, "actual": 250000, "sdate": date(2025, 2, 10),
         "expected": date(2026, 12, 31), "status": "IN_PROGRESS",
         "lat": 18.5, "lon": 73.8},
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("DUPLICATE_WORK")
    assert flagged == {"WT00000", "WT00001"}


async def test_duplicate_detection_distinct_works_not_flagged():
    # SRS AC-ADE-002-02: genuinely different works -> not flagged
    await _seed_works([
        {"desc": "Construction of primary school building at Rampur",
         "amount": 500000, "actual": 450000, "sdate": date(2025, 1, 10),
         "expected": date(2025, 12, 31), "status": "IN_PROGRESS",
         "lat": 18.5, "lon": 73.8},
        {"desc": "Installation of solar street lights at Rampur",
         "amount": 300000, "actual": 200000, "sdate": date(2025, 3, 1),
         "expected": date(2026, 12, 31), "status": "IN_PROGRESS",
         "lat": 18.5, "lon": 73.8},
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("DUPLICATE_WORK")
    assert flagged == set()


async def test_duplicate_detection_cross_constituency_ignored():
    # SRS AC-ADE-002-03: same description in different constituencies -> no flag
    await _seed_works([
        {"desc": "Construction of community hall at Village Rampur", "constituency": "Pune",
         "amount": 500000, "actual": 450000, "sdate": date(2025, 1, 10),
         "expected": date(2025, 12, 31), "status": "IN_PROGRESS", "lat": 18.5, "lon": 73.8},
        {"desc": "Construction of community hall at Village Rampur", "constituency": "Nashik",
         "amount": 505000, "actual": 250000, "sdate": date(2025, 2, 10),
         "expected": date(2026, 12, 31), "status": "IN_PROGRESS", "lat": 19.9, "lon": 73.8},
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("DUPLICATE_WORK")
    assert flagged == set()


async def test_duplicate_amount_filter_rejects_wildly_different_amounts():
    await _seed_works([
        {"desc": "Construction of community hall at Village Rampur",
         "amount": 500000, "actual": 450000, "sdate": date(2025, 1, 10),
         "expected": date(2025, 12, 31), "status": "IN_PROGRESS", "lat": 18.5, "lon": 73.8},
        {"desc": "Construction of community hall in Village Rampur",
         "amount": 2000000, "actual": 1000000, "sdate": date(2025, 2, 10),
         "expected": date(2026, 12, 31), "status": "IN_PROGRESS", "lat": 18.5, "lon": 73.8},
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("DUPLICATE_WORK")
    assert flagged == set()


# ------------------------------------------------------------------ delays
async def test_delay_tiers():
    await _seed_works([
        # in-progress, 50 days past expected -> no flag (<= 90)
        {"desc": "W1", "sdate": date(2024, 1, 1), "expected": REF - timedelta(days=50),
         "status": "IN_PROGRESS", "amount": 100000, "actual": 50000},
        # in-progress, 120 days past -> MEDIUM
        {"desc": "W2", "sdate": date(2024, 1, 1), "expected": REF - timedelta(days=120),
         "status": "IN_PROGRESS", "amount": 100000, "actual": 50000},
        # in-progress, 200 days past -> HIGH
        {"desc": "W3", "sdate": date(2024, 1, 1), "expected": REF - timedelta(days=200),
         "status": "IN_PROGRESS", "amount": 100000, "actual": 50000},
        # in-progress, 400 days past -> CRITICAL
        {"desc": "W4", "sdate": date(2024, 1, 1), "expected": REF - timedelta(days=400),
         "status": "IN_PROGRESS", "amount": 100000, "actual": 50000},
        # completed on time -> no flag
        {"desc": "W5", "sdate": date(2024, 1, 1), "expected": date(2024, 12, 31),
         "completion": date(2024, 12, 1), "status": "COMPLETED", "amount": 100000, "actual": 90000},
        # sanctioned long ago with no start -> STALLED
        {"desc": "W6", "sdate": REF - timedelta(days=500), "expected": REF + timedelta(days=100),
         "status": "SANCTIONED", "amount": 100000, "actual": 0},
    ])
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Work.work_id, Anomaly.anomaly_type, Anomaly.severity)
            .join(Anomaly, Anomaly.work_id == Work.id)
            .where(Anomaly.anomaly_type.in_(["DELAYED_PROJECT", "STALLED_PROJECT"]))
            .order_by(Work.work_id))).all()
    found = {(r[0], r[1], r[2]) for r in rows}
    assert ("WT00001", "DELAYED_PROJECT", "MEDIUM") in found
    assert ("WT00002", "DELAYED_PROJECT", "HIGH") in found
    assert ("WT00003", "DELAYED_PROJECT", "CRITICAL") in found
    assert ("WT00005", "STALLED_PROJECT", "HIGH") in found
    assert len(found) == 4


async def test_completed_late_work_flagged():
    await _seed_works([
        {"desc": "W1", "sdate": date(2024, 1, 1), "expected": date(2024, 12, 31),
         "completion": date(2025, 8, 1), "status": "COMPLETED", "amount": 100000, "actual": 90000},
    ])
    await _run_detectors()
    flagged = await _anomaly_work_ids("DELAYED_PROJECT")
    assert flagged == {"WT00000"}


# ------------------------------------------------------------------ fund utilization
async def test_fund_utilization_thresholds():
    await _seed_works([
        {"desc": "W1", "amount": 100000, "actual": 10000, "fy": "2024-25"},
        {"desc": "W2", "amount": 100000, "actual": 40000, "fy": "2024-25"},
        {"desc": "W3", "amount": 100000, "actual": 40000, "fy": "2024-25"},
    ])
    # release 100000 for Pune 2024-25 -> expenditure 90000 -> rate 90% (normal)
    async with AsyncSessionLocal() as db:
        c = (await db.execute(select(Constituency).where(Constituency.name == "Pune"))).scalar_one()
        db.add(FundRelease(release_id="REL-T1", constituency_id=c.id, financial_year="2024-25",
                           installment_number=1, amount_released=100000,
                           release_date=date(2024, 8, 1)))
        await db.commit()
    # expenditure = 90000 -> rate 90% (normal).  No anomalies expected.
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        low = (await db.execute(
            select(Anomaly).where(Anomaly.anomaly_type.in_(["LOW_UTILIZATION", "OVER_UTILIZATION"])))).scalars().all()
    assert low == []


async def test_fund_util_low_and_over_flags():
    await _seed_works([
        {"desc": "W1", "amount": 100000, "actual": 5000, "fy": "2024-25"},
        {"desc": "W2", "amount": 100000, "actual": 40000, "fy": "2024-25"},
        {"desc": "W3", "amount": 100000, "actual": 250000, "fy": "2025-26"},
        {"desc": "W4", "amount": 100000, "actual": 20000, "fy": "2025-26"},
    ])
    async with AsyncSessionLocal() as db:
        c = (await db.execute(select(Constituency).where(Constituency.name == "Pune"))).scalar_one()
        db.add_all([
            FundRelease(release_id="REL-T2", constituency_id=c.id, financial_year="2024-25",
                        installment_number=1, amount_released=200000, release_date=date(2024, 8, 1)),
            FundRelease(release_id="REL-T3", constituency_id=c.id, financial_year="2025-26",
                        installment_number=1, amount_released=100000, release_date=date(2025, 8, 1)),
        ])
        await db.commit()
    # 2024-25: exp 45000/200000 = 22.5% -> LOW HIGH ; 2025-26: exp 270000/100000 = 270% -> OVER HIGH
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Anomaly.anomaly_type, Anomaly.severity, Anomaly.details)
            .where(Anomaly.anomaly_type.in_(["LOW_UTILIZATION", "OVER_UTILIZATION"])))).all()
    types = {(r[0], r[1]) for r in rows}
    assert ("LOW_UTILIZATION", "HIGH") in types
    assert ("OVER_UTILIZATION", "HIGH") in types


# ------------------------------------------------------------------ patterns
async def test_amount_clustering_pattern():
    from datetime import date as _d
    rows = []
    for i in range(7):
        rows.append({"desc": f"W{i}", "amount": 500000, "actual": 400000,
                     "sdate": _d(2025, 3, 10), "fy": "2024-25", "status": "IN_PROGRESS"})
    await _seed_works(rows)
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        anoms = (await db.execute(select(Anomaly).where(Anomaly.anomaly_type == "AMOUNT_CLUSTERING"))).scalars().all()
    assert len(anoms) == 1
    assert anoms[0].details["amount"] == 500000
    assert anoms[0].details.get("occurrences", anoms[0].details.get("count")) >= 5


async def test_end_of_year_rush_pattern():
    rows = [
        {"desc": f"W{i}", "amount": 100000 + i * 1000, "actual": 80000,
         "sdate": date(2025, 3, 10) if i < 6 else date(2025, 8, 10),
         "fy": "2024-25", "status": "IN_PROGRESS"} for i in range(10)
    ]
    await _seed_works(rows)  # 6/10 = 60% in March -> HIGH (ratio >= 0.60)
    await _run_detectors()
    async with AsyncSessionLocal() as db:
        anoms = (await db.execute(select(Anomaly).where(Anomaly.anomaly_type == "END_OF_YEAR_RUSH"))).scalars().all()
    assert len(anoms) == 1
    assert anoms[0].severity in ("HIGH", "MEDIUM")
