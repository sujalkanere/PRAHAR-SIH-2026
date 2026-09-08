"""Pydantic schemas for request/response contracts (FR-API-001)."""
from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Auth (FR-AAA-001)
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    role: str
    scope_type: Optional[str] = None
    scope_value: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ---------------------------------------------------------------------------
# Works
# ---------------------------------------------------------------------------
class RiskComponents(BaseModel):
    cost_overrun: int = 0
    delay: int = 0
    duplicate: int = 0
    pattern: int = 0
    fund_utilization: int = 0


class WorkCreateRequest(BaseModel):
    constituency_id: str
    work_description: str = Field(..., min_length=3)
    work_category: str = "ROADS"
    sanctioned_amount: float = Field(..., gt=0)
    actual_expenditure: float = 0.0
    sanction_date: date
    expected_completion_date: Optional[date] = None
    completion_date: Optional[date] = None
    work_status: str = "SANCTIONED"
    implementing_agency: Optional[str] = "District Authority"
    financial_year: str = "2024-25"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class WorkOut(BaseModel):
    id: str
    work_id: str
    constituency_id: str
    constituency_name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    work_description: str
    work_category: str
    sanctioned_amount: float
    actual_expenditure: float
    cost_overrun_percentage: float
    sanction_date: date
    expected_completion_date: Optional[date] = None
    completion_date: Optional[date] = None
    work_status: str
    implementing_agency: Optional[str] = None
    financial_year: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    risk_score: int = 0
    risk_tier: str = "LOW"
    risk_components: Optional[RiskComponents] = None
    delay_days: Optional[int] = None
    anomaly_flags: list[str] = []

    class Config:
        from_attributes = True


class Pagination(BaseModel):
    page: int
    per_page: int
    total_records: int
    total_pages: int


class WorkListResponse(BaseModel):
    data: list[WorkOut]
    pagination: Pagination


# ---------------------------------------------------------------------------
# Constituencies
# ---------------------------------------------------------------------------
class ConstituencySummary(BaseModel):
    id: str
    name: str
    state: str
    district: Optional[str] = None
    mp_name: Optional[str] = None
    risk_score: Optional[int] = None
    risk_tier: Optional[str] = None
    total_works: int = 0
    total_expenditure: float = 0
    total_funds_released: float = 0
    fund_utilization_rate: Optional[float] = None
    active_anomalies: int = 0
    financial_year: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Anomalies
# ---------------------------------------------------------------------------
class AnomalyOut(BaseModel):
    id: str
    work_id: Optional[str] = None
    work_ref: Optional[str] = None
    constituency_id: str
    constituency_name: Optional[str] = None
    state: Optional[str] = None
    anomaly_type: str
    category: Optional[str] = None
    severity: str
    confidence_score: float
    detection_method: str
    details: Optional[dict] = None
    status: str
    note: Optional[str] = None
    detected_at: datetime

    class Config:
        from_attributes = True


class AnomalyUpdateRequest(BaseModel):
    status: str
    note: Optional[str] = None


class DuplicatePairOut(BaseModel):
    work_a_ref: str
    work_b_ref: str
    work_a_description: str
    work_b_description: str
    text_similarity: float
    amount_similarity: float
    composite_score: int
    severity: str
    detected_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
class KPIItem(BaseModel):
    key: str
    label: str
    value: Any
    format: str = "number"


class NationalSummary(BaseModel):
    kpis: list[KPIItem]
    risk_distribution: dict
    anomaly_distribution: dict
    top_risky_constituencies: list[dict]
    trends: list[dict]
    state_summaries: list[dict]
    recent_alerts: list[dict]


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
class UploadResponse(BaseModel):
    upload_id: str
    records_parsed: int
    records_valid: int
    records_rejected: int
    validation_errors: list[dict]
    ingestion_timestamp: str
    detection_triggered: bool = True


class SyntheticRequest(BaseModel):
    num_constituencies: int = Field(50, ge=1, le=543)
    num_works_per_constituency: int = Field(100, ge=1, le=500)
    anomaly_injection_rate: float = Field(0.08, ge=0.0, le=0.5)
    seed: int = 42


class DetectionRunOut(BaseModel):
    id: str
    status: str
    anomalies_detected: int
    works_analyzed: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Reports (FR-DVZ-004)
# ---------------------------------------------------------------------------
class ReportRequest(BaseModel):
    scope: str = Field(..., pattern="^(NATIONAL|STATE|CONSTITUENCY)$")
    scope_id: Optional[str] = None
    financial_year: str = "ALL"
    anomaly_types: Optional[list[str]] = None
    severity_filter: Optional[list[str]] = None
    format: str = Field("PDF", pattern="^(PDF|CSV)$")


class ReportResponse(BaseModel):
    report_id: str
    download_url: str
