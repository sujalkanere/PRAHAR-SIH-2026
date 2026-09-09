import os
import sys
import tempfile
import asyncio
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

def test_all_scenarios():
    from app.services.synthetic_generator import generate_synthetic, GeneratorParams
    from app.api.admin import _load_dfs_to_db
    from app.database import init_db_sync, SyncSessionLocal
    from app.services.anomaly_detection.pipeline import run_detection_pipeline
    from app.models import Constituency, ConstituencyRiskScore, Anomaly, Work
    from sqlalchemy import select, func

    scenarios = [
        ("0% Baseline", 0.0),
        ("8% Low", 0.08),
        ("25% Moderate", 0.25),
        ("50% Severe", 0.50),
        ("0% Restored", 0.0),
    ]
    results = []

    for name, r in scenarios:
        db_file = os.path.join(tempfile.gettempdir(), f"mplads_test_{name.replace(' ', '_').replace('%', '')}.db").replace("\\", "/")
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass
        
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_file}"
        os.environ["SYNC_DATABASE_URL"] = f"sqlite:///{db_file}"
        from app.config import get_settings
        get_settings.cache_clear()

        from app.database import async_engine, sync_engine, Base
        Base.metadata.drop_all(sync_engine)
        Base.metadata.create_all(sync_engine)

        # Generate synthetic data
        dfs = generate_synthetic(GeneratorParams(
            num_constituencies=50,
            num_works_per_constituency=100,
            anomaly_injection_rate=r,
            seed=42
        ))

        from app.database import AsyncSessionLocal
        async def _load():
            async with AsyncSessionLocal() as db:
                return await _load_dfs_to_db(db, dfs)
        asyncio.run(_load())

        # Run pipeline
        run_detection_pipeline(triggered_by=None, trigger_type="MANUAL")

        # Now evaluate State Risk using the exact same logic as analytics.py
        with SyncSessionLocal() as session:
            works_count = session.query(Work).count()
            labels_df = dfs["anomaly_labels"]
            if "work_id" in labels_df.columns and len(labels_df) > 0:
                affected_records = len(set(labels_df["work_id"].dropna()))
            else:
                affected_records = 0

            # State risk scores
            consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}
            risk_rows = session.execute(
                select(ConstituencyRiskScore, Constituency.state)
                .join(Constituency, Constituency.id == ConstituencyRiskScore.constituency_id)
            ).all()

            # Latest FY per constituency
            latest_by_cid = {}
            for row in risk_rows:
                crs, st = row
                cid = str(crs.constituency_id)
                if cid not in latest_by_cid or crs.financial_year > latest_by_cid[cid][0].financial_year:
                    latest_by_cid[cid] = (crs, st)

            state_map = {}
            for crs, st in latest_by_cid.values():
                s = state_map.setdefault(st, {
                    "state": st, "avg_risk": 0.0, "max_risk": 0.0, "constituencies": 0, "works": 0,
                    "critical_cnt": 0, "high_cnt": 0, "anomalies": 0,
                })
                s["constituencies"] += 1
                s["works"] += crs.total_works
                s["avg_risk"] += crs.risk_score
                s["max_risk"] = max(s["max_risk"], float(crs.risk_score))
                if crs.risk_tier == "CRITICAL":
                    s["critical_cnt"] += 1
                if crs.risk_tier in ("HIGH", "CRITICAL"):
                    s["high_cnt"] += 1

            state_anom_counts = dict(session.execute(
                select(Constituency.state, func.count(Anomaly.id))
                .join(Constituency, Constituency.id == Anomaly.constituency_id)
                .group_by(Constituency.state)
            ).all())

            state_scores = []
            for s in state_map.values():
                n = s["constituencies"]
                anom_cnt = state_anom_counts.get(s["state"], 0)
                s["anomalies"] = anom_cnt
                if n > 0:
                    raw_avg = s["avg_risk"] / n
                    max_r = s["max_risk"]
                    crit_pct = s["critical_cnt"] / n
                    high_pct = s["high_cnt"] / n
                    total_state_works = max(1, s["works"])
                    state_anom_rate = min(1.0, anom_cnt / total_state_works)
                    
                    # Controlled, bounded anomaly impact:
                    anomaly_impact = state_anom_rate * 22.0
                    baseline_state_risk = (raw_avg * 0.75) + (max_r * 0.15) + (high_pct * 8.0) + (crit_pct * 12.0)
                    final_score = round(min(100.0, max(5.0, baseline_state_risk + anomaly_impact)), 1)
                else:
                    final_score = 0.0
                state_scores.append(final_score)

            low_s = sum(1 for sc in state_scores if sc < 25)
            med_s = sum(1 for sc in state_scores if 25 <= sc < 50)
            high_s = sum(1 for sc in state_scores if 50 <= sc < 75)
            crit_s = sum(1 for sc in state_scores if sc >= 75)

            results.append({
                "injection_rate": name,
                "total_records": works_count,
                "affected_records": f"{affected_records} ({affected_records/works_count*100:.1f}%)" if works_count else "0",
                "avg_state_risk": f"{sum(state_scores)/len(state_scores):.1f}" if state_scores else "0",
                "min_state_risk": f"{min(state_scores):.1f}" if state_scores else "0",
                "max_state_risk": f"{max(state_scores):.1f}" if state_scores else "0",
                "low_states": low_s,
                "medium_states": med_s,
                "high_states": high_s,
                "critical_states": crit_s,
            })

    print("\nBENCHMARK SCENARIOS EVALUATION:")
    print("-" * 115)
    header = f"{'Scenario':<15} | {'Affected Records':<20} | {'Avg Risk':<9} | {'Min Risk':<9} | {'Max Risk':<9} | {'Low (<25)':<10} | {'Med (25-49)':<12} | {'High (50-74)':<13} | {'Crit (>=75)':<11}"
    print(header)
    print("-" * 115)
    for res in results:
        line = f"{res['injection_rate']:<15} | {res['affected_records']:<20} | {res['avg_state_risk']:<9} | {res['min_state_risk']:<9} | {res['max_state_risk']:<9} | {res['low_states']:<10} | {res['medium_states']:<12} | {res['high_states']:<13} | {res['critical_states']:<11}"
        print(line)
    print("-" * 115)

if __name__ == "__main__":
    test_all_scenarios()
