"""Compliance Monitoring API endpoints (SRS Appendix A - /api/v1/compliance)."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_sync_db
from app.services.compliance_rules_engine import (
    RULEBOOK,
    run_compliance_scan,
    simulate_proposed_work_compliance,
)

router = APIRouter(prefix="/api/v1/compliance", tags=["Compliance Monitoring"])


class SimulateWorkRequest(BaseModel):
    work_description: str = Field(..., example="Construction of SC community hall in Ward 12")
    work_category: str = Field(..., example="Community Infra")
    sanctioned_amount: float = Field(..., example=1500000.0)
    is_sc_area: bool = Field(False, example=True)
    is_st_area: bool = Field(False, example=False)
    annual_cumulative_sanctions: float = Field(0.0, example=32000000.0)


@router.get("/summary", summary="Get Compliance Overview & KPI Metrics")
def get_compliance_summary(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns high-level compliance KPI metrics, pass rates, and SC/ST entitlement status."""
    scan = run_compliance_scan(db)
    return scan["summary"]


@router.get("/rules", summary="Get MPLADS Guideline Machine-Readable Rulebook")
def get_rulebook(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns the full catalog of machine-readable rules with guideline section references and violation stats."""
    scan = run_compliance_scan(db)
    return {
        "total_rules": len(scan["rulebook"]),
        "rules": scan["rulebook"],
    }


@router.get("/alerts", summary="Get Active Guideline Violation Alerts")
def get_compliance_alerts(
    severity: str | None = Query(None, description="Filter by severity: CRITICAL, HIGH, MEDIUM, LOW"),
    category: str | None = Query(None, description="Filter by category: Sanction, Allocation, Execution, Payment"),
    db: Session = Depends(get_sync_db),
) -> Dict[str, Any]:
    """Returns generated compliance alerts with work details, broken rules, and guideline clause citations."""
    scan = run_compliance_scan(db)
    alerts = scan["alerts"]

    if severity:
        alerts = [a for a in alerts if a["severity"].upper() == severity.upper()]
    if category:
        alerts = [a for a in alerts if a["category"].lower() == category.lower()]

    return {
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


@router.get("/sc-st-quotas", summary="Get Constituency SC/ST Allocation Quota Compliance")
def get_sc_st_quotas(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Returns per-MP constituency breakdown of the 15% SC and 7.5% ST mandatory portfolio fund allocations."""
    scan = run_compliance_scan(db)
    return {
        "sc_mandate_target_pct": 15.0,
        "st_mandate_target_pct": 7.5,
        "total_constituencies": len(scan["sc_st_quotas"]),
        "quotas": scan["sc_st_quotas"],
    }


@router.post("/rescan", summary="Trigger Full Compliance Scan")
def rescan_compliance(db: Session = Depends(get_sync_db)) -> Dict[str, Any]:
    """Triggers a fresh full compliance scan across all works and constituencies."""
    scan = run_compliance_scan(db, force_refresh=True)
    return {
        "status": "SUCCESS",
        "message": f"Compliance scan complete across {scan['summary']['total_works_scanned']:,} works. Found {scan['summary']['total_active_alerts']:,} active guideline alerts.",
        "summary": scan["summary"],
    }


@router.post("/simulate", summary="Live Pre-Sanction Rule Evaluation Sandbox")
def simulate_work(payload: SimulateWorkRequest) -> Dict[str, Any]:
    """Pre-Sanction Rule Simulator: Tests a proposed work against the MPLADS Rules Engine before sanctioning."""
    return simulate_proposed_work_compliance(payload.model_dump())
