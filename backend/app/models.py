"""SQLAlchemy models — mirrors SRS Section 5.5 database schema.

All tables from the SRS are implemented; a few small, clearly-marked
additions support features required elsewhere in the SRS
(constituencies.district for RBAC scope, works.risk_components for the
risk breakdown radar, anomalies.assigned_to + note for the alert
management workflow, refresh_tokens for JWT rotation).
"""
import uuid
from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Constituency(Base):
    __tablename__ = "constituencies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=True)  # addition (RBAC scope)
    mp_name: Mapped[str] = mapped_column(String(255), nullable=True)
    mp_type: Mapped[str] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    works = relationship("Work", back_populates="constituency")


class Work(Base):
    __tablename__ = "works"
    __table_args__ = (
        CheckConstraint("sanctioned_amount > 0", name="ck_works_sanctioned_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    work_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    constituency_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("constituencies.id"), nullable=False
    )
    work_description: Mapped[str] = mapped_column(Text, nullable=False)
    work_category: Mapped[str] = mapped_column(String(50), nullable=False)
    sanctioned_amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    actual_expenditure: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    cost_overrun_percentage: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    sanction_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_completion_date: Mapped[date] = mapped_column(Date, nullable=True)
    completion_date: Mapped[date] = mapped_column(Date, nullable=True)
    work_status: Mapped[str] = mapped_column(String(20), nullable=False)
    implementing_agency: Mapped[str] = mapped_column(String(255), nullable=True)
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=True)
    description_embedding: Mapped[list] = mapped_column(Vector(384), nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_tier: Mapped[str] = mapped_column(String(10), default="LOW")
    risk_components: Mapped[dict] = mapped_column(JSON, nullable=True)  # addition (FR-DVZ-002 radar)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    constituency = relationship("Constituency", back_populates="works")


class FundRelease(Base):
    __tablename__ = "fund_releases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    release_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    constituency_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("constituencies.id"), nullable=False
    )
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    installment_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_released: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    release_date: Mapped[date] = mapped_column(Date, nullable=False)
    cumulative_release: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Anomaly(Base):
    __tablename__ = "anomalies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    work_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("works.id"), nullable=True
    )
    constituency_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("constituencies.id"), nullable=False
    )
    anomaly_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 4), default=1.0)
    detection_method: Mapped[str] = mapped_column(String(50), default="RULE_BASED")
    details: Mapped[dict] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="NEW")
    note: Mapped[str] = mapped_column(Text, nullable=True)  # addition (FR-DVZ-003 notes)
    assigned_to: Mapped[str] = mapped_column(String(100), nullable=True)  # addition
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    work = relationship("Work")


class DuplicatePair(Base):
    __tablename__ = "duplicate_pairs"
    __table_args__ = (
        UniqueConstraint("work_id_a", "work_id_b", name="uq_duplicate_pair"),
        CheckConstraint("work_id_a < work_id_b", name="ck_pair_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    work_id_a: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("works.id"), nullable=False)
    work_id_b: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("works.id"), nullable=False)
    text_similarity: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    amount_similarity: Mapped[float] = mapped_column(Numeric(5, 4), default=0)
    composite_score: Mapped[int] = mapped_column(Integer, default=0)
    anomaly_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("anomalies.id"), nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConstituencyRiskScore(Base):
    __tablename__ = "constituency_risk_scores"
    __table_args__ = (
        UniqueConstraint("constituency_id", "financial_year", name="uq_const_fy"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    constituency_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("constituencies.id"), nullable=False
    )
    financial_year: Mapped[str] = mapped_column(String(10), nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_tier: Mapped[str] = mapped_column(String(10), nullable=False)
    total_works: Mapped[int] = mapped_column(Integer, default=0)
    high_risk_works: Mapped[int] = mapped_column(Integer, default=0)
    fund_utilization_rate: Mapped[float] = mapped_column(Numeric(8, 2), nullable=True)
    total_funds_released: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    total_expenditure: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    scope_type: Mapped[str] = mapped_column(String(20), nullable=True)
    scope_value: Mapped[str] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    # INSERT-only table: no UPDATE/DELETE allowed (enforced in application layer).

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str] = mapped_column(String(255), nullable=True)
    old_value: Mapped[dict] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UploadHistory(Base):
    __tablename__ = "upload_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    records_total: Mapped[int] = mapped_column(Integer, default=0)
    records_valid: Mapped[int] = mapped_column(Integer, default=0)
    records_rejected: Mapped[int] = mapped_column(Integer, default=0)
    validation_errors: Mapped[list] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PROCESSING")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class DetectionRun(Base):
    __tablename__ = "detection_runs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    triggered_by: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(20), default="MANUAL")
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")
    anomalies_detected: Mapped[int] = mapped_column(Integer, default=0)
    works_analyzed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)


class RefreshToken(Base):
    """addition — server-side refresh token registry for rotation/logout (NFR-SEC-007)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid)
    jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Alert categories used by the dashboard (SRS 1.2.1)
# ---------------------------------------------------------------------------
ANOMALY_CATEGORY_MAP = {
    "COST_OVERRUN": "COST_OVERRUN",
    "DUPLICATE_WORK": "DUPLICATE_WORK",
    "DELAYED_PROJECT": "DELAYED_PROJECT",
    "STALLED_PROJECT": "DELAYED_PROJECT",
    "LOW_UTILIZATION": "FUND_MISUTILIZATION",
    "OVER_UTILIZATION": "FUND_MISUTILIZATION",
    "SUDDEN_UTILIZATION_SHIFT": "FUND_MISUTILIZATION",
    "FUND_UTILIZATION_ANOMALY": "FUND_MISUTILIZATION",
    "AMOUNT_CLUSTERING": "PATTERN_ANOMALY",
    "END_OF_YEAR_RUSH": "PATTERN_ANOMALY",
    "ROUND_NUMBER_BIAS": "PATTERN_ANOMALY",
    "AGENCY_CONCENTRATION": "PATTERN_ANOMALY",
    "PAYMENT_RISK": "PAYMENT_RISK",
    "COMPLIANCE_RISK": "COMPLIANCE_RISK",
    "DURABILITY_RISK": "DURABILITY_RISK",
}

SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

VALID_WORK_CATEGORIES = [
    "EDUCATION", "HEALTH", "DRINKING_WATER", "SANITATION", "ROADS",
    "COMMUNITY_ASSETS", "POWER", "SPORTS", "OTHER",
]
VALID_WORK_STATUSES = ["SANCTIONED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "ON_HOLD"]
VALID_ANOMALY_STATUSES = ["NEW", "ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "FALSE_POSITIVE"]
VALID_RISK_TIERS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
