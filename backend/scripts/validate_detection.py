"""Anomaly detection validation against synthetic ground truth (SRS 7.2).

Usage:
    python scripts/validate_detection.py [--constituencies N] [--works-per-constituency N]
                                         [--keep-data] [--skip-load]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import os
import tempfile

pg_ok = False
try:
    import psycopg2
    conn = psycopg2.connect("postgresql://mplads:mplads_secure_password@localhost:5432/mplads_sentinel", connect_timeout=1)
    conn.close()
    pg_ok = True
except Exception:
    pg_ok = False

if not pg_ok:
    db_path = os.path.join(tempfile.gettempdir(), "mplads_validate.db").replace("\\", "/")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
    os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{db_path}"

from sqlalchemy import select
from app.config import get_settings
get_settings.cache_clear()
from app.database import init_db_sync, SyncSessionLocal
from app.models import Anomaly, Constituency, Work

settings = get_settings()


def load_synthetic(session, num_constituencies: int, works_per: int) -> dict:
    from app.api.admin import _load_dfs_to_db
    from app.services.synthetic_generator import GeneratorParams, generate_synthetic

    dfs = generate_synthetic(GeneratorParams(
        num_constituencies=num_constituencies,
        num_works_per_constituency=works_per,
        seed=42,
    ))
    import asyncio
    asyncio.run(_load_dfs_to_db(session, dfs))  # session must be async — handled below
    return dfs


async def main_async(num_constituencies: int, works_per: int, keep_data: bool, skip_load: bool):
    from app.database import AsyncSessionLocal
    from app.services.anomaly_detection.pipeline import run_detection_pipeline

    labels_df: pd.DataFrame | None = None
    if not skip_load:
        from app.api.admin import _load_dfs_to_db
        from app.services.synthetic_generator import GeneratorParams, generate_synthetic

        dfs = generate_synthetic(GeneratorParams(
            num_constituencies=num_constituencies,
            num_works_per_constituency=works_per, seed=42))
        async with AsyncSessionLocal() as db:
            await _load_dfs_to_db(db, dfs)
        labels_df = dfs["anomaly_labels"]
        labels_df.to_csv(f"{settings.data_dir}/synthetic_anomaly_labels.csv", index=False)

    result = run_detection_pipeline(triggered_by=None)
    print(result)

    if labels_df is None:
        labels_df = pd.read_csv(f"{settings.data_dir}/synthetic_anomaly_labels.csv")

    session = SyncSessionLocal()
    try:
        consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}
        works = {w.work_id: w for w in session.execute(select(Work)).scalars().all()}
        anomalies = list(session.execute(select(Anomaly)).scalars().all())

        # ---- predicted sets ----
        pred_overrun = {a.details.get("work_ref") for a in anomalies if a.anomaly_type == "COST_OVERRUN"}
        pred_dup = {a.details.get("work_ref") for a in anomalies if a.anomaly_type == "DUPLICATE_WORK"}
        pred_delay = {a.details.get("work_ref") for a in anomalies
                      if a.anomaly_type in ("DELAYED_PROJECT", "STALLED_PROJECT")}
        pred_fund = {(a.details.get("constituency"), a.details.get("financial_year"))
                     for a in anomalies if a.anomaly_type in (
                         "LOW_UTILIZATION", "OVER_UTILIZATION", "SUDDEN_UTILIZATION_SHIFT",
                         "FUND_UTILIZATION_ANOMALY")}
        pred_fund.discard((None, None))

        # ---- actual (ground truth) sets ----
        act_overrun = set(labels_df.loc[labels_df.anomaly_type == "COST_OVERRUN", "work_id"].dropna())
        act_dup = set(labels_df.loc[labels_df.anomaly_type == "DUPLICATE_WORK", "work_id"].dropna())
        act_delay = set(labels_df.loc[labels_df.anomaly_type == "DELAYED_PROJECT", "work_id"].dropna())
        fl = labels_df[labels_df.anomaly_type == "FUND_MISUTILIZATION"]
        act_fund = set(zip(fl["constituency_name"], fl["financial_year"])) if len(fl) else set()

        # ---- metrics ----
        def metrics(pred: set, act: set) -> dict:
            tp = len(pred & act)
            fp = len(pred - act)
            fn = len(act - pred)
            precision = tp / (tp + fp) if (tp + fp) else 1.0
            recall = tp / (tp + fn) if (tp + fn) else 1.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
            return {"tp": tp, "fp": fp, "fn": fn, "precision": precision,
                    "recall": recall, "f1": f1}

        overall_pred = pred_overrun | pred_dup | pred_delay | pred_fund
        overall_act = act_overrun | act_dup | act_delay | act_fund

        m = {
            "COST_OVERRUN": metrics(pred_overrun, act_overrun),
            "DUPLICATE_WORK": metrics(pred_dup, act_dup),
            "DELAYED_PROJECT": metrics(pred_delay, act_delay),
            "FUND_UTILIZATION": metrics(pred_fund, act_fund),
            "OVERALL": metrics(overall_pred, overall_act),
        }

        targets = {
            "COST_OVERRUN": (0.70, 0.80, 0.75),
            "DUPLICATE_WORK": (0.75, 0.80, None),
            "DELAYED_PROJECT": (0.90, 0.95, None),
            "FUND_UTILIZATION": (0.80, 0.85, None),
            "OVERALL": (0.70, 0.80, None),
        }

        print("=" * 60)
        print("MPLADS Sentinel - Anomaly Detection Validation")
        print("=" * 60)
        print(f"Dataset: {result['works_analyzed']} works, "
              f"{sum(len(v) for v in (act_overrun, act_dup, act_delay, act_fund))} injected anomalies")
        fails = 0
        for name in ("COST_OVERRUN", "DUPLICATE_WORK", "DELAYED_PROJECT", "FUND_UTILIZATION", "OVERALL"):
            mm = m[name]
            pt, rt, ft = targets[name]
            ok_p = mm["precision"] >= pt
            ok_r = mm["recall"] >= rt
            ok_f1 = True if ft is None else mm["f1"] >= ft
            status = "PASS" if (ok_p and ok_r and ok_f1) else "FAIL"
            if status == "FAIL":
                fails += 1
            print(f"{name}:")
            print(f"  Precision: {mm['precision']:.2f}  (target: >= {pt}) [{('PASS' if ok_p else 'FAIL')}]")
            print(f"  Recall:    {mm['recall']:.2f}  (target: >= {rt}) [{('PASS' if ok_r else 'FAIL')}]")
            if ft is not None:
                print(f"  F1:        {mm['f1']:.2f}  (target: >= {ft}) [{'PASS' if ok_f1 else 'FAIL'}]")
            print(f"  (TP={mm['tp']}, FP={mm['fp']}, FN={mm['fn']})")
        print("-" * 60)
        print(f"VALIDATION RESULT: {'ALL PASS' if fails == 0 else f'{fails} FAILURES'}")
        print("=" * 60)
        return 0 if fails == 0 else 1
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--constituencies", type=int, default=50)
    parser.add_argument("--works-per-constituency", type=int, default=100)
    parser.add_argument("--skip-load", action="store_true", help="reuse data already in DB")
    parser.add_argument("--keep-data", action="store_true")
    args = parser.parse_args()

    import asyncio
    init_db_sync()
    rc = asyncio.run(main_async(args.constituencies, args.works_per_constituency,
                                args.keep_data, args.skip_load))
    sys.exit(rc)
