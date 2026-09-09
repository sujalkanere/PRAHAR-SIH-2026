"""Composite risk scoring engine (FR-RSE-001).

Work-level score (0-100): cost overrun (25) + delay (25) + duplicate (25)
+ pattern (15) + fund utilization (10), per the SRS component tables.
Constituency-level score: avg_work_risk*0.4 + high_risk_ratio*100*0.35
+ fund_util_anomaly*25, capped at 100.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    Anomaly,
    Constituency,
    ConstituencyRiskScore,
    Work,
)

TIER_MAP = [(25, "LOW"), (50, "MEDIUM"), (75, "HIGH"), (10**9, "CRITICAL")]


def tier_for(score: int) -> str:
    for limit, tier in TIER_MAP:
        if score <= limit:
            return tier
    return "CRITICAL"


# ---------------------------------------------------------------------------
# Work-level components
# ---------------------------------------------------------------------------
def cost_overrun_component(overrun_pct: float) -> int:
    if overrun_pct <= 0:
        return 0
    if overrun_pct <= 15:
        return 5
    if overrun_pct <= 30:
        return 15
    if overrun_pct <= 50:
        return 20
    return 25


def delay_component(delay_days: int) -> int:
    if delay_days <= 0:
        return 0
    if delay_days <= 90:
        return 5
    if delay_days <= 180:
        return 10
    if delay_days <= 365:
        return 20
    return 25


def duplicate_component(composite_score: int | None) -> int:
    if composite_score is None:
        return 0
    if composite_score > 70:
        return 25
    if composite_score >= 50:
        return 15
    return 0


def payment_risk_component(work_anomalies: list[Anomaly]) -> int:
    score = 0
    for a in work_anomalies:
        if a.anomaly_type == "PAYMENT_RISK":
            if a.severity == "CRITICAL":
                score = max(score, 100)
            elif a.severity == "HIGH":
                score = max(score, 75)
            elif a.severity == "MEDIUM":
                score = max(score, 50)
            else:
                score = max(score, 25)
    return score


def compliance_risk_component(work_anomalies: list[Anomaly]) -> int:
    score = 0
    for a in work_anomalies:
        if a.anomaly_type == "COMPLIANCE_RISK":
            if a.severity == "CRITICAL":
                score = max(score, 100)
            elif a.severity == "HIGH":
                score = max(score, 75)
            elif a.severity == "MEDIUM":
                score = max(score, 50)
            else:
                score = max(score, 25)
    return score


def durability_risk_component(work_anomalies: list[Anomaly]) -> int:
    score = 0
    for a in work_anomalies:
        if a.anomaly_type == "DURABILITY_RISK":
            if a.severity == "CRITICAL":
                score = max(score, 100)
            elif a.severity == "HIGH":
                score = max(score, 75)
            elif a.severity == "MEDIUM":
                score = max(score, 50)
            else:
                score = max(score, 25)
    return score


def run_risk_scoring(session: Session) -> dict:
    works = list(session.execute(select(Work)).scalars().all())
    consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}
    anomalies = list(session.execute(select(Anomaly)).scalars().all())
    now = datetime.now(timezone.utc)

    # index anomalies
    work_anomalies: dict[str, list[Anomaly]] = defaultdict(list)
    const_anomalies: dict[str, list[Anomaly]] = defaultdict(list)
    for a in anomalies:
        if a.work_id:
            work_anomalies[str(a.work_id)].append(a)
        const_anomalies[str(a.constituency_id)].append(a)

    # fund-utilization flag per constituency
    fund_util_consts: set[str] = {
        cid for cid, lst in const_anomalies.items()
        if any(a.anomaly_type in ("LOW_UTILIZATION", "OVER_UTILIZATION",
                                  "SUDDEN_UTILIZATION_SHIFT", "FUND_UTILIZATION_ANOMALY") for a in lst)
    }

    # pattern flags per (constituency, fy)
    cluster_amounts: dict[str, set[float]] = defaultdict(set)          # cid -> amounts
    cluster_work_ids: dict[str, set[str]] = defaultdict(set)           # cid -> work ids
    eoy_consts: set[str] = set()
    round_bias_consts: set[str] = set()
    agency_dominance: dict[str, str] = {}                              # cid -> agency
    for cid, lst in const_anomalies.items():
        for a in lst:
            d = a.details or {}
            if a.anomaly_type == "AMOUNT_CLUSTERING":
                cluster_amounts[cid].add(float(d.get("amount", -1)))
                for wid in d.get("work_ids", []):
                    cluster_work_ids[cid].add(str(wid))
            elif a.anomaly_type == "END_OF_YEAR_RUSH":
                eoy_consts.add(cid)
            elif a.anomaly_type == "ROUND_NUMBER_BIAS":
                round_bias_consts.add(cid)
            elif a.anomaly_type == "AGENCY_CONCENTRATION":
                agency_dominance[cid] = d.get("agency", "")

    for w in works:
        cid = str(w.constituency_id)
        w_anoms = work_anomalies.get(str(w.id), [])

        # cost overrun component (0-25)
        overrun = float(w.cost_overrun_percentage or 0)
        co = cost_overrun_component(overrun)

        # delay component (0-25)
        delay_days = 0
        for a in w_anoms:
            if a.anomaly_type in ("DELAYED_PROJECT", "STALLED_PROJECT"):
                delay_days = max(delay_days, int((a.details or {}).get("delay_days", 0)))
                if a.anomaly_type == "STALLED_PROJECT":
                    delay_days = max(delay_days, 366)
        dl = delay_component(delay_days)

        # duplicate component (0-25)
        dup_score: int | None = None
        for a in w_anoms:
            if a.anomaly_type == "DUPLICATE_WORK":
                cs = int((a.details or {}).get("composite_score", 0))
                dup_score = cs if dup_score is None else max(dup_score, cs)
        dp = duplicate_component(dup_score)

        # pattern component (cap 15)
        pat = 0
        if cid in cluster_work_ids and str(w.work_id) in cluster_work_ids.get(cid, set()):
            pat += 5
        elif cid in cluster_amounts and float(w.sanctioned_amount) in cluster_amounts.get(cid, set()):
            pat += 5
        if cid in eoy_consts and w.sanction_date.month == 3:
            pat += 5
        if cid in round_bias_consts and float(w.sanctioned_amount) % 100000 == 0:
            pat += 2
        if cid in agency_dominance and w.implementing_agency == agency_dominance[cid]:
            pat += 3
        pat = min(pat, 15)

        # fund utilization component (0-10)
        fu = 10 if cid in fund_util_consts else 0

        # Six target risk dimensions (0-100 normalized)
        c_risk = int(round(co * 4))
        d_risk = int(round(dl * 4))
        dup_risk = dup_score if dup_score is not None else 0
        p_risk = payment_risk_component(w_anoms)
        cmp_risk = compliance_risk_component(w_anoms)
        dur_risk = durability_risk_component(w_anoms)

        # Base composite score
        base_total = co + dl + dp + pat + fu

        # If target risk anomalies fire, incorporate into final composite
        addon = 0
        if p_risk > 0:
            addon += int(round(p_risk * 0.15))
        if cmp_risk > 0:
            addon += int(round(cmp_risk * 0.15))
        if dur_risk > 0:
            addon += int(round(dur_risk * 0.15))

        total = min(100, base_total + addon)
        tier = tier_for(total)
        if w.risk_score != total or w.risk_tier != tier or total > 0:
            w.risk_score = total
            w.risk_tier = tier
            w.risk_components = {
                # 6 Target Dimensions
                "cost_risk": c_risk,
                "delay_risk": d_risk,
                "payment_risk": p_risk,
                "duplicate_risk": dup_risk,
                "compliance_risk": cmp_risk,
                "durability_risk": dur_risk,
                # Legacy component breakdown preserved for compatibility
                "cost_overrun": co,
                "delay": dl,
                "duplicate": dp,
                "pattern": pat,
                "fund_utilization": fu,
            }

    session.flush()

    # ---- constituency-level scores ----
    session.execute(delete(ConstituencyRiskScore))
    by_const: dict[str, list[Work]] = defaultdict(list)
    for w in works:
        by_const[str(w.constituency_id)].append(w)

    fy_to_works: dict[str, dict[str, list[Work]]] = defaultdict(lambda: defaultdict(list))
    for w in works:
        fy_to_works[str(w.constituency_id)][w.financial_year].append(w)

    from app.services.anomaly_detection.fund_utilization import compute_utilization

    util = compute_utilization(session)

    for cid, ws in by_const.items():
        const = consts.get(cid)
        if const is None:
            continue
        for fy, fy_works in fy_to_works[cid].items():
            if not fy_works:
                continue
            scores = [w.risk_score for w in fy_works]
            avg = sum(scores) / len(scores)
            high_ratio = sum(1 for s in scores if s > 50) / len(scores)
            fu_flag = 1 if cid in fund_util_consts else 0
            cscore = min(100, int(round(avg * 0.4 + high_ratio * 100 * 0.35 + fu_flag * 25)))
            u = util.get((cid, fy), {})
            session.add(ConstituencyRiskScore(
                id=uuid.uuid4(), constituency_id=const.id, financial_year=fy,
                risk_score=cscore, risk_tier=tier_for(cscore),
                total_works=len(fy_works),
                high_risk_works=sum(1 for s in scores if s > 50),
                fund_utilization_rate=round(u.get("rate", 0), 2) if u.get("rate") is not None else None,
                total_funds_released=round(u.get("released", 0), 2),
                total_expenditure=round(u.get("expenditure", 0), 2),
                calculated_at=now,
            ))

    session.commit()
    return {"works_scored": len(works), "constituencies_scored": len(by_const)}
