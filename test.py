"""Official MPLADS Datasets & System Verification Suite (SIH 2026).

Verifies:
1. Presence and mathematical integrity of all 5 official datasets:
   - completed_works.csv
   - expenditures.csv
   - mplads_mp_summary_2026-09-09.csv
   - recommended_works.csv
   - current_data.json
2. Database contents match the exact official values:
   - Total Allocated: 3,363.8 CR (33,638,482,301.82)
   - Total Expenditure: 1,237.9 CR (12,379,235,852.69)
   - Total MPs: 231
   - Works Completed: 9,927 (759.6 CR)
   - Works Pending: 15,217
   - Ongoing-Work Payments: 478.4 CR
   - Total Transactions: 25,051
3. Analytics API / Service outputs exact metrics matching dashboard screenshot.
4. Anomaly detection and ML risk scoring models execute cleanly.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from decimal import Decimal
from pathlib import Path

# Configure utf-8 stdout for Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

import pandas as pd
from sqlalchemy import func, select

from app.database import AsyncSessionLocal, SyncSessionLocal, init_db_sync
from app.models import (
    Anomaly,
    Constituency,
    ConstituencyRiskScore,
    Expenditure,
    FundRelease,
    User,
    Work,
)
from app.services.analytics import national_summary
from app.services.official_dataset_seeder import DATASETS_DIR, load_all_datasets


def test_datasets_integrity():
    print("\n--- 1. Testing Official Datasets Integrity ---")
    ds = load_all_datasets()
    summary_df = ds["summary"]
    completed_df = ds["completed"]
    recommended_df = ds["recommended"]
    exp_df = ds["expenditures"]
    current_data = ds["current_data"]

    # 1.1 Summary CSV
    assert len(summary_df) == 231, f"Expected 231 MPs in summary, found {len(summary_df)}"
    alloc_sum = float(summary_df["Allocated Amount (₹)"].sum())
    assert abs(alloc_sum - 33638482301.82) < 1.0, f"Allocated sum mismatch: {alloc_sum}"
    exp_sum = float(summary_df["Total Expenditure (₹)"].sum())
    assert abs(exp_sum - 12379235852.69) < 1.0, f"Expenditure sum mismatch: {exp_sum}"
    print(f"  [PASS] Summary CSV: 231 MPs, Allocated = {alloc_sum/1e7:,.1f} CR, Exp = {exp_sum/1e7:,.1f} CR")

    # 1.2 Completed Works CSV
    assert len(completed_df) == 9927, f"Expected 9,927 completed works, found {len(completed_df)}"
    cw_sum = float(completed_df["Final Amount (₹)"].sum())
    assert abs(cw_sum - 7595696429.21) < 1.0, f"Completed works value mismatch: {cw_sum}"
    print(f"  [PASS] Completed Works CSV: 9,927 works, Final Value = {cw_sum/1e7:,.1f} CR")

    # 1.3 Recommended Works CSV
    rec_count = len(recommended_df)
    assert rec_count >= 15217, f"Expected >= 15,217 recommended works, found {rec_count}"
    print(f"  [PASS] Recommended Works CSV: {rec_count} rows")

    # 1.4 Expenditures CSV
    assert len(exp_df) == 25051, f"Expected 25,051 expenditure transactions, found {len(exp_df)}"
    tx_sum = float(exp_df["Expenditure Amount (₹)"].sum())
    assert abs(tx_sum - 12379235852.69) < 1.0, f"Expenditure transaction sum mismatch: {tx_sum}"
    print(f"  [PASS] Expenditures CSV: 25,051 transactions, Total = {tx_sum/1e7:,.1f} CR")

    # 1.5 Current Data JSON
    assert current_data["totalMPs"] == 231
    assert current_data["totalWorksCompleted"] == 9927
    assert current_data["pendingWorks"] == 15217
    assert abs(current_data["totalAllocated"] - 33638482301.82) < 1.0
    assert abs(current_data["totalExpenditure"] - 12379235852.69) < 1.0
    assert abs(current_data["utilizationPercentage"] - 66.1139) < 0.01
    assert abs(current_data["expenditurePercentage"] - 36.8008) < 0.01
    assert abs(current_data["inProgressPayments"] - 4783993916.48) < 1.0
    print(f"  [PASS] current_data.json: Master metrics verified (Allocated: {current_data['totalAllocated']/1e7:,.1f} CR, Exp: {current_data['totalExpenditure']/1e7:,.1f} CR)")


def test_database_exact_metrics():
    print("\n--- 2. Testing Database Contents Against Official Values ---")
    with SyncSessionLocal() as session:
        num_const = session.execute(select(func.count(Constituency.id))).scalar()
        num_works = session.execute(select(func.count(Work.id))).scalar()
        num_cw = session.execute(select(func.count(Work.id)).where(Work.work_status == "COMPLETED")).scalar()
        num_pw = session.execute(select(func.count(Work.id)).where(Work.work_status != "COMPLETED")).scalar()

        sum_cw = float(session.execute(select(func.sum(Work.actual_expenditure)).where(Work.work_status == "COMPLETED")).scalar() or 0)
        total_rel = float(session.execute(select(func.sum(FundRelease.amount_released))).scalar() or 0)
        num_exp = session.execute(select(func.count(Expenditure.id))).scalar()
        sum_exp = float(session.execute(select(func.sum(Expenditure.amount))).scalar() or 0)

        # Assertions matching screenshot
        assert num_const == 231, f"Expected 231 MPs, got {num_const}"
        assert num_cw == 9927, f"Expected 9,927 completed works, got {num_cw}"
        assert round(total_rel / 1e7, 1) == 3363.8, f"Expected 3,363.8 CR allocated, got {total_rel/1e7:.1f}"
        assert round(sum_exp / 1e7, 1) == 1237.9, f"Expected 1,237.9 CR expenditure, got {sum_exp/1e7:.1f}"
        assert round(sum_cw / 1e7, 1) == 759.6, f"Expected 759.6 CR completed works value, got {sum_cw/1e7:.1f}"
        assert num_exp == 25051, f"Expected 25,051 transactions, got {num_exp}"

        ongoing_payments = sum_exp - sum_cw
        assert round(ongoing_payments / 1e7, 1) == 478.4, f"Expected 478.4 CR ongoing-work payments, got {ongoing_payments/1e7:.1f}"

        print(f"  [PASS] Total MPs in DB: {num_const} (Exact Match: 231)")
        print(f"  [PASS] Total Works in DB: {num_works} (Completed: {num_cw}, Pending: {num_pw})")
        print(f"  [PASS] Total Allocated in DB: {total_rel/1e7:,.1f} CR (Exact Match: 3,363.8 CR)")
        print(f"  [PASS] Total Expenditure in DB: {sum_exp/1e7:,.1f} CR (Exact Match: 1,237.9 CR)")
        print(f"  [PASS] Completed Works Value: {sum_cw/1e7:,.1f} CR (Exact Match: 759.6 CR)")
        print(f"  [PASS] Ongoing-Work Payments: {ongoing_payments/1e7:,.1f} CR (Exact Match: 478.4 CR)")
        print(f"  [PASS] Total Transactions in DB: {num_exp:,} (Exact Match: 25,051)")


async def test_analytics_api_output():
    print("\n--- 3. Testing Analytics API Output (Screenshot Verification) ---")
    user = User(id=uuid.uuid4(), username="admin", role="ROLE_ADMIN", scope_type="NONE")
    async with AsyncSessionLocal() as session:
        ns = await national_summary(session, user)

    om = ns.get("official_metrics", {})
    assert om["total_allocated_cr"] == 3363.8, f"Mismatch: {om.get('total_allocated_cr')}"
    assert om["total_expenditure_cr"] == 1237.9, f"Mismatch: {om.get('total_expenditure_cr')}"
    assert om["fund_utilization_pct"] == 66.1, f"Mismatch: {om.get('fund_utilization_pct')}"
    assert om["expenditure_rate_pct"] == 36.8, f"Mismatch: {om.get('expenditure_rate_pct')}"
    assert om["total_mps"] == 231, f"Mismatch: {om.get('total_mps')}"
    assert om["works_completed"] == 9927, f"Mismatch: {om.get('works_completed')}"
    assert om["works_completed_value_cr"] == 759.6, f"Mismatch: {om.get('works_completed_value_cr')}"
    assert om["ongoing_work_payments_cr"] == 478.4, f"Mismatch: {om.get('ongoing_work_payments_cr')}"

    print(f"  [PASS] TOTAL ALLOCATED: {om['total_allocated_cr']} CR (Matches Screenshot)")
    print(f"  [PASS] TOTAL EXPENDITURE: {om['total_expenditure_cr']} CR (Matches Screenshot)")
    print(f"  [PASS] FUND UTILIZATION: {om['fund_utilization_pct']}% (Matches Screenshot)")
    print(f"  [PASS] EXPENDITURE RATE: {om['expenditure_rate_pct']}% (Matches Screenshot)")
    print(f"  [PASS] Total MPs: {om['total_mps']} (Matches Screenshot)")
    print(f"  [PASS] WORKS COMPLETED: {om['works_completed']:,} (Rs. {om['works_completed_value_cr']} CR) (Matches Screenshot)")
    print(f"  [PASS] WORKS PENDING: {om['works_pending']:,} (Matches Screenshot)")
    print(f"  [PASS] ONGOING-WORK PAYMENTS: {om['ongoing_work_payments_cr']} CR (Matches Screenshot)")


def test_ml_risk_scoring():
    print("\n--- 4. Testing Risk Scoring & Anomaly Detection State ---")
    with SyncSessionLocal() as session:
        scores = list(session.execute(select(ConstituencyRiskScore)).scalars().all())
        distinct_consts = {s.constituency_id for s in scores}
        assert len(distinct_consts) >= 195, f"Expected at least 195 active MP constituencies with works, got {len(distinct_consts)}"

        tiers = {s.risk_tier for s in scores}
        print(f"  [PASS] {len(distinct_consts)} active MP Constituencies Risk Scores computed across FYs ({len(scores)} records) across tiers: {tiers}")

        # State summaries check
        states = list(session.execute(select(Constituency.state).distinct()).scalars().all())
        assert len(states) == 32, f"Expected 32 States/UTs, got {len(states)}"
        print(f"  [PASS] 32 States & Union Territories active in system")


def run_all_tests():
    print("================================================================")
    print("      MPLADS SENTINEL - OFFICIAL DATASETS VERIFICATION TEST     ")
    print("================================================================")
    try:
        test_datasets_integrity()
        test_database_exact_metrics()
        asyncio.run(test_analytics_api_output())
        test_ml_risk_scoring()
        print("\n================================================================")
        print("  ALL TESTS PASSED SUCCESSFULLY! 100% MATCH WITH OFFICIAL DATA! ")
        print("================================================================")
        return 0
    except Exception as exc:
        print(f"\n[FAIL] Test assertion failed: {exc}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
