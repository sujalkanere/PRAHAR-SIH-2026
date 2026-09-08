"""
Golden unit tests for new analytical detectors:
- Payment detection (PAY-001, PAY-002, PAY-003)
- Compliance detection (CMP-001, CMP-002, CMP-003)
- Durability detection (DUR-001)
- Explainability service (generate_deterministic_explanation)
"""

import uuid
from datetime import date, datetime, timedelta
import pytest
from sqlalchemy import select
from app.models import Work, Anomaly, Constituency
from app.services.anomaly_detection.payment_detection import detect_payment_risk, clear_payment_risk
from app.services.anomaly_detection.compliance_detection import detect_compliance_risk, clear_compliance_risk
from app.services.anomaly_detection.durability_detection import detect_durability_risk, clear_durability_risk
from app.services.explanations import generate_deterministic_explanation


def test_payment_detection_pay001_and_pay002(sync_session):
    c = Constituency(id=uuid.uuid4(), name="Pune", state="Maharashtra")
    sync_session.add(c)

    # w1: PAY-002 (unreconciled payment overflow: ratio 1.30 > 1.25)
    w1 = Work(
        id=uuid.uuid4(),
        work_id="TEST-PAY-001",
        constituency_id=c.id,
        work_category="COMMUNITY",
        work_description="Construction of community center",
        sanctioned_amount=1_000_000.0,
        actual_expenditure=1_300_000.0,  # 30% overspend
        sanction_date=date(2024, 1, 1),
        work_status="IN_PROGRESS",
        financial_year="2024-25",
    )
    # w2: PAY-001 (premature disbursement: 90% disbursed while SANCTIONED)
    w2 = Work(
        id=uuid.uuid4(),
        work_id="TEST-PAY-002",
        constituency_id=c.id,
        work_category="ROADS",
        work_description="Road widening work",
        sanctioned_amount=500_000.0,
        actual_expenditure=450_000.0,  # 90% disbursed
        sanction_date=date.today() - timedelta(days=15),
        work_status="SANCTIONED",
        financial_year="2024-25",
    )
    # w3: PAY-003 (zero expenditure on completed work)
    w3 = Work(
        id=uuid.uuid4(),
        work_id="TEST-PAY-003",
        constituency_id=c.id,
        work_category="POWER",
        work_description="Installation of street lights",
        sanctioned_amount=200_000.0,
        actual_expenditure=0.0,
        sanction_date=date(2024, 1, 1),
        work_status="COMPLETED",
        financial_year="2024-25",
    )
    sync_session.add_all([w1, w2, w3])
    sync_session.commit()

    created = detect_payment_risk(sync_session)
    assert created >= 3

    anomalies = list(sync_session.execute(select(Anomaly).where(Anomaly.anomaly_type == "PAYMENT_RISK")).scalars().all())
    rule_ids = {(a.details or {}).get("rule_id") for a in anomalies}
    assert "PAY-001" in rule_ids
    assert "PAY-002" in rule_ids
    assert "PAY-003" in rule_ids

    # Verify clear
    cleared = clear_payment_risk(sync_session)
    assert cleared == len(anomalies)


def test_compliance_detection_cmp(sync_session):
    c = Constituency(id=uuid.uuid4(), name="Nagpur", state="Maharashtra")
    sync_session.add(c)

    # w1: CMP-001 (completion date before sanction date)
    w1 = Work(
        id=uuid.uuid4(),
        work_id="TEST-CMP-001",
        constituency_id=c.id,
        work_category="ROADS",
        work_description="Culvert bridge repair",
        sanctioned_amount=400_000.0,
        sanction_date=date(2024, 6, 1),
        completion_date=date(2024, 5, 1),  # before sanction
        work_status="COMPLETED",
        implementing_agency="PWD",
        financial_year="2024-25",
    )
    # w2: CMP-002 (missing/unspecified agency)
    w2 = Work(
        id=uuid.uuid4(),
        work_id="TEST-CMP-002",
        constituency_id=c.id,
        work_category="COMMUNITY",
        work_description="Community hall repairs",
        sanctioned_amount=600_000.0,
        implementing_agency="N/A",
        sanction_date=date(2024, 1, 1),
        work_status="IN_PROGRESS",
        financial_year="2024-25",
    )
    sync_session.add_all([w1, w2])
    sync_session.commit()

    created = detect_compliance_risk(sync_session)
    assert created >= 2

    anomalies = list(sync_session.execute(select(Anomaly).where(Anomaly.anomaly_type == "COMPLIANCE_RISK")).scalars().all())
    rule_ids = {(a.details or {}).get("rule_id") for a in anomalies}
    assert "CMP-001" in rule_ids
    assert "CMP-002" in rule_ids

    cleared = clear_compliance_risk(sync_session)
    assert cleared == len(anomalies)


def test_durability_detection_dur001(sync_session):
    c = Constituency(id=uuid.uuid4(), name="Thane", state="Maharashtra")
    sync_session.add(c)

    # Two repairs on the same road within 180 days
    w1 = Work(
        id=uuid.uuid4(),
        work_id="TEST-DUR-001A",
        constituency_id=c.id,
        work_category="ROADS",
        work_description="Urgent repair and patching of Station Road",
        sanctioned_amount=150_000.0,
        sanction_date=date(2024, 1, 10),
        work_status="COMPLETED",
        financial_year="2023-24",
    )
    w2 = Work(
        id=uuid.uuid4(),
        work_id="TEST-DUR-001B",
        constituency_id=c.id,
        work_category="ROADS",
        work_description="Maintenance repair and resurfacing of Station Road",
        sanctioned_amount=180_000.0,
        sanction_date=date(2024, 4, 15),  # 96 days later
        work_status="SANCTIONED",
        financial_year="2024-25",
    )
    sync_session.add_all([w1, w2])
    sync_session.commit()

    created = detect_durability_risk(sync_session)
    assert created >= 1

    anomalies = list(sync_session.execute(select(Anomaly).where(Anomaly.anomaly_type == "DURABILITY_RISK")).scalars().all())
    assert any((a.details or {}).get("rule_id") == "DUR-001" for a in anomalies)

    cleared = clear_durability_risk(sync_session)
    assert cleared == len(anomalies)


def test_generate_work_explanation():
    cid = uuid.uuid4()
    w = Work(
        id=uuid.uuid4(),
        work_id="EXP-TEST-001",
        constituency_id=cid,
        work_category="HEALTH",
        work_description="Construction of rural clinic",
        sanctioned_amount=1_000_000.0,
        actual_expenditure=1_300_000.0,
        sanction_date=date(2024, 1, 1),
        work_status="IN_PROGRESS",
        financial_year="2024-25",
    )
    anom = Anomaly(
        id=uuid.uuid4(),
        work_id=w.id,
        constituency_id=cid,
        anomaly_type="PAYMENT_RISK",
        severity="HIGH",
        status="ACTIVE",
        confidence_score=0.95,
        details={"rule_id": "PAY-001", "pay_ratio": 1.3, "reason": "Expenditure exceeded sanction."},
    )
    explanation = generate_deterministic_explanation(w, [anom])
    assert explanation["work_id"] == "EXP-TEST-001"
    assert explanation["tier"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(explanation["components"]) == 6
    assert len(explanation["evidence"]) >= 1
    assert explanation["evidence"][0]["rule_id"] == "PAY-001"
    assert explanation["generator"] == "DETERMINISTIC_LOCAL"
    assert explanation["auditable"] is True
