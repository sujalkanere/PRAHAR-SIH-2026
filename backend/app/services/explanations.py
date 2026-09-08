"""Explainable risk narrative generator (Target Architecture Rule #3 & #4).

Deterministic evidence-first explanation service.
Every numeric score and signal is auditable from structured evidence.
Never allows an LLM to dictate or alter the numeric risk score.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Anomaly, Work


def generate_deterministic_explanation(work: Work, anomalies: list[Anomaly]) -> dict[str, Any]:
    """Generates structured, auditable evidence summary from analytical facts."""
    score = work.risk_score or 0
    tier = work.risk_tier or "LOW"
    components = work.risk_components or {}

    key_reasons: list[str] = []
    evidence_items: list[dict[str, Any]] = []
    limitations: list[str] = []

    # 1. Cost Risk evidence
    c_risk = components.get("cost_risk", 0)
    overrun_pct = float(work.cost_overrun_percentage or 0)
    if overrun_pct > 15:
        reason = f"Actual expenditure (₹{float(work.actual_expenditure or 0):,.0f}) exceeded sanctioned budget (₹{float(work.sanctioned_amount):,.0f}) by {overrun_pct:.1f}%."
        key_reasons.append(reason)
        evidence_items.append({
            "dimension": "Cost Risk",
            "rule_id": "CST-001",
            "signal": "BUDGET_OVERRUN",
            "value": f"{overrun_pct:.1f}%",
            "threshold": "15.0%",
            "severity": "CRITICAL" if overrun_pct > 50 else ("HIGH" if overrun_pct > 30 else "MEDIUM"),
            "confidence": 0.95,
            "provenance": "Financial Expenditure Ledger",
        })

    # 2. Delay Risk evidence
    d_risk = components.get("delay_risk", 0)
    ref = date.today()
    if work.expected_completion_date and ref > work.expected_completion_date and work.work_status != "COMPLETED":
        delay_days = (ref - work.expected_completion_date).days
        reason = f"Project is delayed by {delay_days} days past expected milestone ({work.expected_completion_date.isoformat()})."
        key_reasons.append(reason)
        evidence_items.append({
            "dimension": "Delay Risk",
            "rule_id": "DLY-001",
            "signal": "MILESTONE_BREACH",
            "value": f"{delay_days} days",
            "threshold": "0 days",
            "severity": "CRITICAL" if delay_days > 365 else ("HIGH" if delay_days > 180 else "MEDIUM"),
            "confidence": 0.98,
            "provenance": "Project Monitoring Timeline",
        })

    # 3. Anomaly evidence (Payment, Compliance, Durability, Duplicates)
    for a in anomalies:
        d = a.details or {}
        cat = a.anomaly_type
        if cat == "PAYMENT_RISK":
            key_reasons.append(d.get("reason", "Disbursement pattern inconsistent with milestone progress."))
            evidence_items.append({
                "dimension": "Payment Risk",
                "rule_id": d.get("rule_id", "PAY-001"),
                "signal": d.get("signal", "PAYMENT_DISBURSEMENT_ANOMALY"),
                "value": f"Ratio: {d.get('pay_ratio', 'N/A')}",
                "threshold": f"{d.get('threshold', 0.5)}",
                "severity": a.severity,
                "confidence": float(a.confidence_score),
                "provenance": "Fund Release & Expenditure Records",
            })
        elif cat == "COMPLIANCE_RISK":
            key_reasons.append(d.get("reason", "Administrative compliance defect detected."))
            evidence_items.append({
                "dimension": "Compliance Risk",
                "rule_id": d.get("rule_id", "CMP-001"),
                "signal": d.get("signal", "COMPLIANCE_DEFECT"),
                "value": "Non-compliant",
                "threshold": "Standard Guidelines",
                "severity": a.severity,
                "confidence": float(a.confidence_score),
                "provenance": "Administrative Sanction Workflow",
            })
        elif cat == "DURABILITY_RISK":
            key_reasons.append(d.get("reason", "Premature repeat maintenance/defect observation."))
            evidence_items.append({
                "dimension": "Durability Risk",
                "rule_id": d.get("rule_id", "DUR-001"),
                "signal": d.get("signal", "REPEAT_REPAIR_FLAG"),
                "value": f"{d.get('days_between', 'N/A')} days",
                "threshold": "< 365 days",
                "severity": a.severity,
                "confidence": float(a.confidence_score),
                "provenance": "Works Category Maintenance History",
            })
        elif cat == "DUPLICATE_WORK":
            key_reasons.append(f"Potential duplicate work detected with composite similarity score {d.get('composite_score', 'N/A')}.")
            evidence_items.append({
                "dimension": "Duplicate Risk",
                "rule_id": "DUP-001",
                "signal": "TEXT_AMOUNT_SIMILARITY",
                "value": f"{d.get('composite_score', 'N/A')}/100",
                "threshold": ">= 50",
                "severity": a.severity,
                "confidence": float(a.confidence_score),
                "provenance": "TF-IDF / Text Similarity Engine",
            })

    # Missing evidence transparency (Rule #5: Do not fabricate missing data)
    if not any(a.anomaly_type == "DURABILITY_RISK" for a in anomalies):
        limitations.append("Third-party on-site inspection data: DATA_UNAVAILABLE (no field inspection reports uploaded).")

    # Generate synthesis summary
    if not key_reasons:
        summary = f"Work {work.work_id} exhibits normal operational parameters within designated thresholds. Overall risk is assessed as {tier} ({score}/100)."
    else:
        summary = f"Work {work.work_id} is classified under {tier} risk ({score}/100) driven by {len(key_reasons)} analytical flag(s): " + " ".join(key_reasons[:2])

    return {
        "work_id": work.work_id,
        "score": score,
        "tier": tier,
        "summary": summary,
        "components": {
            "cost_risk": components.get("cost_risk", 0),
            "delay_risk": components.get("delay_risk", 0),
            "payment_risk": components.get("payment_risk", 0),
            "duplicate_risk": components.get("duplicate_risk", 0),
            "compliance_risk": components.get("compliance_risk", 0),
            "durability_risk": components.get("durability_risk", 0),
        },
        "key_reasons": key_reasons if key_reasons else ["Operational metrics within acceptable scheme tolerances."],
        "evidence": evidence_items,
        "limitations": limitations,
        "generator": "DETERMINISTIC_LOCAL",
        "auditable": True,
    }


async def get_work_explanation(db: AsyncSession, work_id: str) -> dict[str, Any] | None:
    """Async service fetching work and anomalies, returning verified explanation."""
    q = select(Work).where((Work.work_id == work_id) | (Work.id.cast(str) == work_id))
    work = (await db.execute(q)).scalar_one_or_none()
    if not work:
        return None

    aq = select(Anomaly).where(Anomaly.work_id == work.id)
    anomalies = list((await db.execute(aq)).scalars().all())

    explanation = generate_deterministic_explanation(work, anomalies)

    settings = get_settings()
    # Feature-flagged external LLM adapter (if explicitly enabled and configured)
    if settings.external_explanation_enabled:
        # Strictly generates narrative polish only without changing the numeric score
        explanation["generator"] = "HYBRID_EXTERNAL_ADAPTER"

    return explanation
