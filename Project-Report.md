# Project Report: PRAHAR — AI-Powered Audit & Anomaly Detection System for MPLADS
**System Designation:** `MPLADS Sentinel` / `PRAHAR-SIH-2026`  
**Problem Statement ID:** SIH-26102 (Smart India Hackathon 2026)  
**Client / Beneficiary:** Ministry of Statistics and Programme Implementation (MoSPI), Government of India  
**Document Classification:** Complete Machine-Readable Architecture, Data Dictionary & Workflow Specification  
**Target Ingestion:** Architectural Review, Code Audit & Modification AI Agents (Zero-Hallucination Grounded)

---

## 1. Executive Summary & Domain Objectives

PRAHAR is an enterprise automated audit and continuous oversight platform built specifically for the **Member of Parliament Local Area Development Scheme (MPLADS)**. The platform provides continuous oversight across all **543 Parliamentary Constituencies** (Lok Sabha & Rajya Sabha), tracking project progression, vendor transactions, fund allocations, and physical completion timelines.

### 1.1 Core Problems Addressed
1. **Uncontrolled Cost Escalations:** Actual expenditures exceeding administrative sanctions without formal approvals.
2. **Project Delays and Ghost Assets:** Sanctioned works lingering unstarted for years or marked completed without recorded expenditures.
3. **Linguistic Duplicate Works:** Repeated allocation of funds to identical or overlapping civil works disguised through lexical alterations across fiscal years.
4. **Premature & Irregular Disbursements:** Bulk release of 50–80%+ funds on works marked unstarted or stalled.
5. **Guideline & Durability Violations:** Allocation to unauthorized private or religious entities, or premature repeat repairs on short-lived infrastructure within 365 days.
6. **Year-End Rush & Vendor Cartels:** Artificial clustering of sanctions in March and single implementing agencies capturing disproportionate budgetary shares.

### 1.2 Ground Truth Baseline Metrics (Official MoSPI Dataset Reconciliation)
- **Total Allocated Limit:** ₹3,363.8 Crore (₹33,638,482,301.82)
- **Total Expenditure Disbursed:** ₹1,237.9 Crore (₹12,379,235,852.69)
- **National Fund Utilization Rate:** 66.1%
- **National Expenditure Rate:** 36.8%
- **Monitored MPs:** 231 Rajya Sabha Members of Parliament across 32 States & Union Territories
- **Total Monitored Works:** 25,168 civil infrastructure projects
  - *Completed Works:* 9,927 projects (valued at ₹759.6 Crore)
  - *Pending / Recommended Works:* 15,241 projects (valued at ₹478.4 Crore)
- **Vendor Payment Line Items:** 25,051 transactions
- **Detected Analytical Anomalies:** 11,742 items flagged across multi-tiered risk scoring

---

## 2. Full System Architecture & Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CLIENT TIER (React 18 SPA)                                       │
│   React 18.2 + Vite 5 + TypeScript + Ant Design 5.12 + Recharts 2.10 + Leaflet 1.9 + Lucide Icons      │
│   (Interactive SVG Choropleth Map, 6-Axis Radar Visualizations, Dynamic Theme Engine, Live Audit Bot)   │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │ HTTPS / REST / JSON (JWT RS256 Bearer)
┌───────────────────────────────────────────────────▼────────────────────────────────────────────────────┐
│                                     API GATEWAY & SECURITY LAYER                                       │
│   - CORS Middleware (Configured origins from settings / regex matching)                                │
│   - Sliding Window In-Memory Rate Limiting (100 req/min/IP or User; Auth: 5 req/min)                   │
│   - JWT RS256/HS256 Guard + Account Lockout Security (5 failed attempts -> 15 min lockout)             │
└───────────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                                    │ Async Request Delegation
┌───────────────────────────────────────────────────▼────────────────────────────────────────────────────┐
│                                FASTAPI ASYNCHRONOUS APPLICATION CORE                                   │
│   Routers: /auth, /works, /constituencies, /anomalies, /analytics, /admin, /reports, /ai               │
│   - Context Manager Lifespan: DB Init, User Seeding, NLP Embedding Warm-up                             │
│   - Global Background Pipeline Orchestrator with Thread Mutex (_PIPELINE_LOCK)                         │
│   - ReportLab 4.x PDF Engine + Streaming CSV Generator (300s TTL Report Cache)                         │
└─────────────────────────┬───────────────────────────────────────────────────┬──────────────────────────┘
                          │                                                   │
┌─────────────────────────▼──────────────────────┐     ┌──────────────────────▼──────────────────────────┐
│          DATABASE & PERSISTENCE TIER           │     │            AI / ML & ANALYTIC SERVICES          │
│   PostgreSQL 16 + pgvector (Production Target) │     │ 1. Cost Overrun (Z-Score + IsoForest)           │
│   SQLite with WAL Mode (Local Dev Target)      │     │ 2. Delay & Stalled Projects Engine              │
│   - 11 Core Relational Tables & Transactions   │     │ 3. Semantic Duplicate Engine (MiniLM-L6-v2)     │
│   - 384-dimensional Vector Embeddings          │     │ 4. Payment Risk (Disbursement Ratios)           │
│   - Append-Only Immutable Audit Log Ledger     │     │ 5. Compliance & Chronology Engine               │
│   - Disk Storage: /reports, /models, /data     │     │ 6. Durability & Repeat Repair Engine            │
│   Redis 7 Alpine (Distributed Cache / Queues)  │     │ 7. Fund Utilization & State Normalizer          │
│                                                │     │ 8. Suspicious Pattern Cluster Engine            │
└────────────────────────────────────────────────┘     │ 9. OpenRouter AI Multi-Model LLM Gateway        │
                                                       └─────────────────────────────────────────────────┘
```

---

## 3. Technology Stack & Component Inventory

| Tier | Component / Library | Version | Technical Purpose & Scope |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React | 18.2.0 | Declarative UI framework with Virtual DOM |
| **Build Tool** | Vite | 5.1.0 | Fast HMR dev server & Rollup bundle optimization |
| **Language (FE)**| TypeScript | 5.2.2 | Strict static typing across components and API models |
| **UI Components**| Ant Design (AntD) | 5.12.8 | Enterprise design system (`ConfigProvider` theming) |
| **Icons** | Lucide React | 0.344.0 | Consistent iconography for status and metrics |
| **Charts & Maps** | Recharts, Leaflet, React-Leaflet | 2.10.4 / 1.9.4 | Radar charts, bar breakdowns, trends, choropleth SVG |
| **HTTP Client** | Axios | 1.6.7 | Interceptor-based client with token injection & 401 handling |
| **Backend Core** | FastAPI | 0.110.0 | High-performance asynchronous REST API framework |
| **ASGI Server** | Uvicorn | 0.28.0 | ASGI production web server |
| **ORM** | SQLAlchemy | 2.0.28 | Declarative ORM supporting AsyncSession & SyncSession |
| **Database Drivers**| asyncpg, psycopg2-binary, aiosqlite | Latest | Native async/sync drivers for PostgreSQL & SQLite |
| **Migrations** | Alembic | 1.13.1 | Database schema revision control |
| **Vector Search**| pgvector | 0.2.5 | Vector type & cosine distance extensions in PostgreSQL |
| **Validation** | Pydantic / Pydantic-Settings | 2.6.4 | Strict payload validation & environment parsing |
| **Machine Learning**| Scikit-learn, SciPy, NumPy, Pandas | Latest | IsolationForest, Z-Score distributions, matrix ops |
| **NLP Vectors** | Sentence-Transformers | 2.5.1 | `all-MiniLM-L6-v2` 384-dimensional dense semantic vectorizer |
| **Auth & Crypto**| PyJWT, Cryptography, Passlib | Latest | RS256 RSA token signing & Bcrypt password hashing |
| **Reporting** | ReportLab, Matplotlib | 4.1.0 / 3.8.3 | PDF generation with custom canvas & dynamic chart figures |
| **Generative AI**| HTTPX + OpenRouter API | 0.27.0 | LLM conversational gateway with free-tier fallback |

---

## 4. Complete Relational Database Schema & Data Dictionary

The data layer consists of 11 relational tables managed under SQLAlchemy 2.0 declarative mappings.

### 4.1 Database Tables Specification

#### 1. `constituencies`
Stores administrative spatial metadata for Parliamentary Constituencies.
- `id` (`UUID`, Primary Key, default `uuid4`): Unique constituency UUID.
- `name` (`String(255)`, Unique, Not Null): Official name of the constituency.
- `state` (`String(100)`, Not Null): Name of the State or Union Territory.
- `district` (`String(100)`, Nullable): Nodal district for administrative RBAC scoping.
- `mp_name` (`String(255)`, Nullable): Name of the representing Member of Parliament.
- `mp_type` (`String(20)`, Nullable): Lok Sabha (`LS`) or Rajya Sabha (`RS`).
- `created_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- `updated_at` (`DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`).
- *Relationships:* `works` (1-to-Many).

#### 2. `works`
The core ledger of sanctioned civil infrastructure works.
- `id` (`UUID`, Primary Key, default `uuid4`): Unique record ID.
- `work_id` (`String(50)`, Unique, Not Null): Alphanumeric identifier (e.g. `W0123456`).
- `constituency_id` (`UUID`, Foreign Key $\to$ `constituencies.id`, Not Null).
- `work_description` (`Text`, Not Null): Natural language description of the work.
- `work_category` (`String(50)`, Not Null): Category code (`ROADS`, `EDUCATION`, `HEALTH`, `DRINKING_WATER`, `SANITATION`, `COMMUNITY_ASSETS`, `POWER`, `SPORTS`, `OTHER`).
- `sanctioned_amount` (`Numeric(15, 2)`, Not Null): Approved cost in INR.
- `actual_expenditure` (`Numeric(15, 2)`, default 0): Cumulative disbursed spending in INR.
- `cost_overrun_percentage` (`Numeric(8, 2)`, default 0): Calculated cost escalation.
- `sanction_date` (`Date`, Not Null): Administrative approval date.
- `expected_completion_date` (`Date`, Nullable): Milestone completion deadline.
- `completion_date` (`Date`, Nullable): Physical completion date.
- `work_status` (`String(20)`, Not Null): `SANCTIONED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ON_HOLD`.
- `implementing_agency` (`String(255)`, Nullable): Executing executive agency.
- `financial_year` (`String(10)`, Not Null): Fiscal cycle (e.g. `2023-24`).
- `latitude` (`Numeric(10, 7)`, Nullable): WGS-84 latitude.
- `longitude` (`Numeric(10, 7)`, Nullable): WGS-84 longitude.
- `description_embedding` (`Vector(384)`, Nullable): Dense semantic vector from `all-MiniLM-L6-v2`.
- `risk_score` (`Integer`, default 0): Composite risk index ($0 - 100$).
- `risk_tier` (`String(10)`, default `LOW`): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `risk_components` (`JSON`, Nullable): Breakdown dictionary of all 6 target dimensions + legacy bases.
- `created_at` / `updated_at` (`DateTime(timezone=True)`).
- *Constraints:* `CheckConstraint("sanctioned_amount > 0", name="ck_works_sanctioned_positive")`.

#### 3. `fund_releases`
Allocations and installment disbursements released by MoSPI.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `release_id` (`String(50)`, Unique, Not Null): Unique release voucher code.
- `constituency_id` (`UUID`, Foreign Key $\to$ `constituencies.id`, Not Null).
- `financial_year` (`String(10)`, Not Null).
- `installment_number` (`Integer`, Not Null): e.g. 1, 2.
- `amount_released` (`Numeric(15, 2)`, Not Null): Amount in INR.
- `release_date` (`Date`, Not Null).
- `cumulative_release` (`Numeric(15, 2)`, default 0).
- `created_at` (`DateTime(timezone=True)`, server_default `func.now()`).

#### 4. `expenditures`
Vendor-level transactional payments mapped against works.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `constituency_id` (`UUID`, Foreign Key $\to$ `constituencies.id`, Not Null).
- `work_id` (`UUID`, Foreign Key $\to$ `works.id`, Nullable).
- `mp_name` (`String(255)`, Not Null).
- `state` (`String(100)`, Not Null).
- `work_description` (`Text`, Not Null).
- `vendor` (`String(255)`, Nullable): Receiving contractor / supplier.
- `ida` (`String(255)`, Nullable): Implementing District Authority identifier.
- `amount` (`Numeric(15, 2)`, Not Null): Transaction value.
- `expenditure_date` (`Date`, Nullable).
- `payment_status` (`String(50)`, Not Null).
- `created_at` (`DateTime(timezone=True)`, server_default `func.now()`).

#### 5. `anomalies`
Audit alerts generated by the 8 analytical engines.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `work_id` (`UUID`, Foreign Key $\to$ `works.id`, Nullable): Associated work if work-level alert.
- `constituency_id` (`UUID`, Foreign Key $\to$ `constituencies.id`, Not Null).
- `anomaly_type` (`String(50)`, Not Null): Anomaly taxonomy code.
- `severity` (`String(10)`, Not Null): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `confidence_score` (`Numeric(5, 4)`, default 1.0): Confidence metric ($0.0 - 1.0$).
- `detection_method` (`String(50)`, default `RULE_BASED`): Rule identifier or ML engine signature.
- `details` (`JSON`, Nullable): Deep forensic context (overrun %, delay days, token overlap, rule IDs).
- `status` (`String(20)`, default `NEW`): `NEW`, `ACKNOWLEDGED`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`.
- `note` (`Text`, Nullable): Auditor verification notes.
- `assigned_to` (`String(100)`, Nullable): Username of assigned investigator.
- `detected_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- `updated_at` (`DateTime(timezone=True)`, server_default `func.now()`, onupdate `func.now()`).

#### 6. `duplicate_pairs`
Detailed pairing records for linguistic duplicate detections.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `work_id_a` (`UUID`, Foreign Key $\to$ `works.id`, Not Null).
- `work_id_b` (`UUID`, Foreign Key $\to$ `works.id`, Not Null).
- `text_similarity` (`Numeric(5, 4)`, Not Null): Dense cosine similarity ($0.0 - 1.0$).
- `amount_similarity` (`Numeric(5, 4)`, default 0): Budget proximity ($0.0 - 1.0$).
- `composite_score` (`Integer`, default 0): Final score ($0 - 100$).
- `anomaly_id` (`UUID`, Foreign Key $\to$ `anomalies.id`, Nullable).
- `detected_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- *Constraints:* `UniqueConstraint("work_id_a", "work_id_b", name="uq_duplicate_pair")`, `CheckConstraint("work_id_a < work_id_b", name="ck_pair_order")`.

#### 7. `constituency_risk_scores`
Calculated macro risk ratings for constituencies per financial year.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `constituency_id` (`UUID`, Foreign Key $\to$ `constituencies.id`, Not Null).
- `financial_year` (`String(10)`, Not Null).
- `risk_score` (`Integer`, Not Null): Macro risk score ($0 - 100$).
- `risk_tier` (`String(10)`, Not Null): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- `total_works` (`Integer`, default 0): Total sanctioned works count.
- `high_risk_works` (`Integer`, default 0): Works with score $\ge 50$.
- `fund_utilization_rate` (`Numeric(8, 2)`, Nullable): Expenditure / Release ratio.
- `total_funds_released` (`Numeric(15, 2)`, default 0).
- `total_expenditure` (`Numeric(15, 2)`, default 0).
- `calculated_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- *Constraints:* `UniqueConstraint("constituency_id", "financial_year", name="uq_const_fy")`.

#### 8. `users`
Administrative and public user directory.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `username` (`String(100)`, Unique, Not Null).
- `password_hash` (`String(255)`, Not Null): Bcrypt salt/hash.
- `full_name` (`String(255)`, Nullable).
- `role` (`String(30)`, Not Null): `ROLE_ADMIN`, `ROLE_MINISTRY`, `ROLE_STATE_NODAL`, `ROLE_DISTRICT`, `ROLE_MP`.
- `scope_type` (`String(20)`, Nullable): `ALL`, `STATE`, `DISTRICT`, `CONSTITUENCY`.
- `scope_value` (`String(255)`, Nullable): Target territorial entity (e.g. `Maharashtra`, `Pune`).
- `is_active` (`Boolean`, default True).
- `failed_login_attempts` (`Integer`, default 0).
- `locked_until` (`DateTime(timezone=True)`, Nullable).
- `created_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- `last_login` (`DateTime(timezone=True)`, Nullable).

#### 9. `audit_log`
Immutable security and administrative audit trail.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `user_id` (`UUID`, Foreign Key $\to$ `users.id`, Nullable).
- `action` (`String(50)`, Not Null): Action verb code.
- `resource_type` (`String(50)`, Nullable): `work`, `anomaly`, `dataset`, `report`, `upload`.
- `resource_id` (`String(255)`, Nullable): Key of modified entity.
- `old_value` (`JSON`, Nullable): State before mutation.
- `new_value` (`JSON`, Nullable): State after mutation.
- `ip_address` (`String(64)`, Nullable): Client remote IP.
- `user_agent` (`Text`, Nullable): Client user agent string.
- `timestamp` (`DateTime(timezone=True)`, server_default `func.now()`).

#### 10. `upload_history`
Batch ingestion registry for CSV file tracking.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `user_id` (`UUID`, Foreign Key $\to$ `users.id`, Not Null).
- `filename` (`String(255)`, Not Null).
- `file_hash` (`String(64)`, Not Null): SHA-256 checksum.
- `file_size_bytes` (`Integer`, default 0).
- `records_total` (`Integer`, default 0).
- `records_valid` (`Integer`, default 0).
- `records_rejected` (`Integer`, default 0).
- `validation_errors` (`JSON`, Nullable): Array of row-level error objects.
- `status` (`String(20)`, default `PROCESSING`): `PROCESSING`, `SUCCESS`, `FAILED`.
- `uploaded_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- `completed_at` (`DateTime(timezone=True)`, Nullable).

#### 11. `detection_runs`
Execution ledger of anomaly detection pipeline jobs.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `triggered_by` (`UUID`, Foreign Key $\to$ `users.id`, Nullable).
- `trigger_type` (`String(20)`, default `MANUAL`): `MANUAL`, `AUTO_POST_UPLOAD`.
- `status` (`String(20)`, default `RUNNING`): `RUNNING`, `COMPLETED`, `FAILED`.
- `anomalies_detected` (`Integer`, default 0).
- `works_analyzed` (`Integer`, default 0).
- `started_at` (`DateTime(timezone=True)`, server_default `func.now()`).
- `completed_at` (`DateTime(timezone=True)`, Nullable).
- `error_message` (`Text`, Nullable).

#### 12. `refresh_tokens`
Server-side token registry for JWT rotation and revocation.
- `id` (`UUID`, Primary Key, default `uuid4`).
- `jti` (`String(64)`, Unique, Not Null): JWT ID claim.
- `user_id` (`UUID`, Foreign Key $\to$ `users.id`, Not Null).
- `expires_at` (`DateTime(timezone=True)`, Not Null).
- `revoked` (`Boolean`, default False).
- `created_at` (`DateTime(timezone=True)`, server_default `func.now()`).

---

## 5. Official Datasets, Ingestion & Seeding Engine

The system supports both real-world official datasets and automated synthetic generators.

### 5.1 Official Datasets Inventory (`datasets/`)
1. **`mplads_mp_summary_2026-09-09.csv`**
   - 231 Rajya Sabha Members of Parliament.
   - Contains: MP Name, State/UT, Nodal District, Total Allocation Limit (₹3,363.8 Cr), Total Expenditure (₹1,237.9 Cr), Utilization Rate (66.1%).
2. **`completed_works.csv`**
   - 9,927 completed projects across 32 States & UTs (aggregate value ₹759.6 Crore).
   - Contains: Work Code, Work Description, Category, Sanctioned Amount, Actual Expenditure, Sanction Date, Completion Date, Implementing Agency.
3. **`recommended_works.csv`**
   - 15,241 pending, ongoing, and recommended works (ongoing disbursements ₹478.4 Crore).
4. **`expenditures.csv`**
   - 25,051 vendor payment transactions.
   - Contains: Voucher Code, Work Reference, Contractor Name, Nodal Authority, Paid Amount, Transaction Date.
5. **`current_data.json`**
   - System master gold-standard metrics used for sanity calibration and instant response fallback.

### 5.2 Geographic Centroids Table (`STATE_CENTROIDS`)
Centroids for all 36 States & UTs used to map geo-spatial coordinates:
- `Andaman And Nicobar Islands`: (11.66, 92.73)
- `Andhra Pradesh`: (15.91, 79.74)
- `Arunachal Pradesh`: (28.21, 94.72)
- `Assam`: (26.20, 92.93)
- `Bihar`: (25.09, 85.31)
- `Chandigarh`: (30.73, 76.77)
- `Chhattisgarh`: (21.27, 81.86)
- `Dadra & Nagar Haveli and Daman & Diu`: (20.42, 72.83)
- `Delhi`: (28.61, 77.20)
- `Goa`: (15.29, 74.12)
- `Gujarat`: (22.25, 71.19)
- `Haryana`: (29.05, 76.08)
- `Himachal Pradesh`: (31.10, 77.17)
- `Jammu And Kashmir`: (33.77, 76.57)
- `Jharkhand`: (23.61, 85.27)
- `Karnataka`: (15.31, 75.71)
- `Kerala`: (10.85, 76.27)
- `Ladakh`: (34.15, 77.57)
- `Lakshadweep`: (10.56, 72.64)
- `Madhya Pradesh`: (22.97, 78.65)
- `Maharashtra`: (19.75, 75.71)
- `Manipur`: (24.66, 93.90)
- `Meghalaya`: (25.46, 91.36)
- `Mizoram`: (23.16, 92.93)
- `Nagaland`: (26.15, 94.56)
- `Odisha`: (20.95, 85.09)
- `Puducherry`: (11.94, 79.80)
- `Punjab`: (31.14, 75.34)
- `Rajasthan`: (27.02, 74.21)
- `Sikkim`: (27.53, 88.51)
- `Tamil Nadu`: (11.12, 78.65)
- `Telangana`: (18.11, 79.01)
- `Tripura`: (23.94, 91.98)
- `Uttar Pradesh`: (26.84, 80.94)
- `Uttarakhand`: (30.06, 79.01)
- `West Bengal`: (22.98, 87.85)

### 5.3 Ingestion Normalization & Aliases (`data_ingestion.py`)
- Maps multi-format input column headers via `COLUMN_ALIASES` dictionary (supports over 80 variations across Hindi and English formats).
- Keyword-based category classification (`CATEGORY_MAP_HINTS`): e.g. `ROAD`, `HIGHWAY` $\to$ `ROADS`; `WATER`, `BOREWELL` $\to$ `DRINKING_WATER`.
- Status classification (`STATUS_MAP_HINTS`): e.g. `COMPLET`, `FINISH` $\to$ `COMPLETED`; `WIP`, `PROGRESS` $\to$ `IN_PROGRESS`.

---

## 6. The 8 Anomaly Detection Engines & Formulations

The pipeline executes 8 specialized detectors sequentially. Stale anomalies from prior runs are cleared idempotently before execution.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRAHAR DETECTION PIPELINE                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
  [1] Cost Overrun Detector (cost_overrun.py)
      ├── Rule: Overrun = (Expenditure - Sanction) / Sanction > 15%
      ├── Peer Category Z-Score: |Z| > 2.5 against category mean (μ) and standard deviation (σ)
      └── Unsupervised ML: Isolation Forest (100 trees, 5% contamination) on 5-D feature vectors

  [2] Delay & Stalled Projects Detector (delay_detection.py)
      ├── Ongoing Overdue: Ref_Date - Expected_Date > 90 days (MEDIUM), > 180 (HIGH), > 365 (CRIT)
      ├── Completed Post-Milestone: Completion_Date - Expected_Date > 180 days
      └── Stalled Project: Work marked SANCTIONED with 0 progress > 365 days from sanction

  [3] Semantic Duplicate Works Detector (duplicate_detection.py)
      ├── NLP Dense Embedding: all-MiniLM-L6-v2 (Cosine Similarity > 0.85)
      ├── Stopword-Pruned Jaccard Token Overlap: J(A, B) >= 0.70
      ├── Attribute Gates: |Amount Diff| / Max < 30%, |Sanction Gap| < 365 days
      └── Multi-Attribute Score (0–100): Cosine*40 + S_amt*20 + S_time*15 + S_geo*15 + S_cat*10

  [4] Payment Risk Detector (payment_detection.py)
      ├── Premature Disbursement: Actual / Sanctioned > 50% on SANCTIONED or NOT_STARTED status
      ├── Unreconciled Payment Overflow: Actual / Sanctioned > 125% without sanction revision
      └── Ghost Expenditure: Status = COMPLETED with 0 actual expenditure

  [5] Compliance & Feasibility Detector (compliance_detection.py)
      ├── Inverted Chronology: Completion Date < Sanction Date (CMP-001)
      ├── Generic Agency: Agency in ('general', 'unassigned', 'unknown', 'na', '-') (CMP-002)
      └── Timeline Feasibility: Expected Completion <= Sanction Date for works > ₹1,00,000 (CMP-003)

  [6] Durability & Asset Quality Detector (durability_detection.py)
      └── Premature Repeat Repair: Subsequent work containing repair keywords in same category
          sanctioned within 365 days (DUR-001)

  [7] Fund Utilization Discrepancy Detector (fund_utilization.py)
      ├── Utilization Rate = (Cumulative Expenditure / Cumulative Funds Released) * 100
      ├── Absolute Thresholds: < 30% (CRITICAL/HIGH), < 50% (MEDIUM), > 110% (OVER_UTILIZATION)
      ├── State Peer Z-Score: |Z| > 2.0 against state-wide constituency utilization distribution
      └── Temporal Volatility: Year-over-Year utilization shift > 40 percentage points

  [8] Suspicious Pattern Clustering Detector (pattern_detection.py)
      ├── Rupee Amount Clustering: >= 5 works with identical sanction amounts in same FY
      ├── End-of-Year Rush: > 40% of all FY sanctions issued in March (> 60% is HIGH severity)
      ├── Round Number Bias: > 80% of works clustered at exact ₹1,00,000 increments
      └── Implementing Agency Dominance: Single vendor/agency capturing > 80% of total FY budget
```

### 6.1 Cost Overrun Detector (`cost_overrun.py`)
- **Overrun Calculation:**
  $$\text{Overrun \%} = \frac{\text{Actual Expenditure} - \text{Sanctioned Amount}}{\text{Sanctioned Amount}} \times 100$$
- **Threshold Rule:** Triggered when $\text{Overrun \%} > 15.0\%$.
  - $\text{Overrun} > 50\% \implies \text{CRITICAL}$
  - $\text{Overrun} > 30\% \implies \text{HIGH}$
  - $\text{Overrun} > 15\% \implies \text{MEDIUM}$
- **Category Peer Z-Score:**
  $$Z = \frac{\text{Overrun \%} - \mu_{\text{category}}}{\sigma_{\text{category}}}$$
  Evaluated across peer works in the identical category with sample size $N \ge 3$. Flagged if $|Z| > 2.5$.
- **Isolation Forest Enrichment:**
  Trained on 5-D feature vectors:
  $$\mathbf{X} = [\text{sanctioned\_amount}, \text{actual\_expenditure}, \text{overrun\_pct}, \text{duration\_days}, \text{cost\_per\_day}]$$
  Parameters: `n_estimators=100`, `contamination=0.05`, `random_state=42`. Negative decision scores append `+ISOLATION_FOREST` to the detection signature.

### 6.2 Delay & Stalling Detector (`delay_detection.py`)
- **Ongoing Projects Overdue:**
  If status $\in$ (`SANCTIONED`, `IN_PROGRESS`, `ON_HOLD`) and $\text{Ref Date} > \text{Expected Completion Date}$:
  $$\text{Delay Days} = \text{Ref Date} - \text{Expected Completion Date}$$
  - $\text{Delay} > 365\text{ days} \implies \text{CRITICAL}$
  - $\text{Delay} > 180\text{ days} \implies \text{HIGH}$
  - $\text{Delay} > 90\text{ days} \implies \text{MEDIUM}$
- **Completed Late Projects:**
  If status $=$ `COMPLETED` and $\text{Completion Date} - \text{Expected Completion Date} > 180\text{ days} \implies \text{HIGH}$.
- **Stalled Work Detection:**
  If status $=$ `SANCTIONED` and $\text{Ref Date} - \text{Sanction Date} > 365\text{ days} \implies \text{STALLED\_PROJECT}$ (`HIGH`).

### 6.3 Semantic Duplicate Works Detector (`duplicate_detection.py`)
Identifies repeated or overlapping civil projects within the same constituency:
1. **Sentence Transformers Embedding:** `sentence-transformers/all-MiniLM-L6-v2` produces 384-dimensional dense vectors with mean pooling and L2 normalization:
   $$\text{CosSim}(\mathbf{u}, \mathbf{v}) = \mathbf{u} \cdot \mathbf{v} \quad (\text{since } \|\mathbf{u}\| = \|\mathbf{v}\| = 1)$$
   Candidates must satisfy $\text{CosSim} > 0.85$.
2. **Lexical Jaccard Overlap:**
   $$J(A, B) = \frac{|T_A \cap T_B|}{|T_A \cup T_B|} \ge 0.70$$
   Tokens are stripped of 17 common syntactic function stopwords (`at`, `in`, `for`, `the`, `of`, `to`, `a`, `an`, etc.) to prevent preposition modifications from masking duplicates.
3. **Hard Compatibility Gates:**
   - Sanctioned amount gap: $\frac{|A_1 - A_2|}{\max(A_1, A_2)} < 0.30$
   - Sanction date gap: $|\text{Date}_1 - \text{Date}_2| < 365\text{ days}$
4. **Geodesic Proximity:** Haversine formula calculates real-world distance ($d$):
   $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos \phi_1 \cos \phi_2 \sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
   Geographic proximity score: $S_{\text{geo}} = \max\left(0, 1 - \frac{d}{2.0\text{ km}}\right)$.
5. **Multi-Attribute Composite Duplicate Score ($0 - 100$):**
   $$\text{Score} = (40 \times \text{CosSim}) + (20 \times S_{\text{amount}}) + (15 \times S_{\text{temporal}}) + (15 \times S_{\text{geo}}) + S_{\text{cat}}$$
   *(Where $S_{\text{cat}} = 10 \text{ if categories match, else } 0$)*.
   - $\text{Score} \ge 70 \implies \text{HIGH}$ severity.
   - $\text{Score} \in [50, 69] \implies \text{MEDIUM}$ severity.

### 6.4 Payment Risk Detector (`payment_detection.py`)
- **Signal 1 (Premature Disbursement):** Status $\in$ (`SANCTIONED`, `NOT_STARTED`) and $\frac{\text{Actual Expenditure}}{\text{Sanctioned Amount}} > 0.50$:
  - Ratio $> 0.80 \implies \text{CRITICAL}$ (`PAY-001`)
  - Ratio $> 0.50 \implies \text{HIGH}$ (`PAY-001`)
- **Signal 2 (Unreconciled Expenditure Overflow):** Status $\in$ (`IN_PROGRESS`, `SANCTIONED`) and $\frac{\text{Actual Expenditure}}{\text{Sanctioned Amount}} > 1.25$:
  - Ratio $> 1.50 \implies \text{CRITICAL}$ (`PAY-002`)
  - Ratio $> 1.25 \implies \text{HIGH}$ (`PAY-002`)
- **Signal 3 (Ghost / Unrecorded Expenditure):** Status $=$ `COMPLETED` and $\text{Actual Expenditure} = 0 \implies \text{HIGH}$ (`PAY-003`).

### 6.5 Compliance & Chronology Detector (`compliance_detection.py`)
- **Signal 1 (Inverted Chronology):** $\text{Completion Date} < \text{Sanction Date} \implies \text{CRITICAL}$ (`CMP-001`).
- **Signal 2 (Generic / Unmapped Agency):** Implementing agency $\in$ (`general`, `unassigned`, `unknown`, `district authority`, `na`, `none`, `-`) $\implies \text{MEDIUM}$ (`CMP-002`).
- **Signal 3 (Impossible Timeline):** Expected completion $\le$ Sanction Date for works with Sanctioned Amount $> ₹1,00,000 \implies \text{HIGH}$ (`CMP-003`).

### 6.6 Durability & Quality Detector (`durability_detection.py`)
- Grouped by `(constituency_id, work_category)`.
- If a subsequent work matching repair keywords (`repair`, `renovation`, `re-surfacing`, `re-carpeting`, `maintenance`, `re-laying`, `patchwork`, `damage`, `reconstruction`) is sanctioned within $365\text{ days}$ of an earlier work in the same category:
  - Interval $\le 180\text{ days} \implies \text{HIGH}$ (`DUR-001`)
  - Interval $\le 365\text{ days} \implies \text{MEDIUM}$ (`DUR-001`)

### 6.7 Fund Utilization Discrepancy Detector (`fund_utilization.py`)
- **Utilization Formula:**
  $$\text{Utilization Rate} = \frac{\sum \text{Actual Expenditure}}{\sum \text{Funds Released}} \times 100$$
- **Absolute Gates:**
  - Rate $< 30\% \implies \text{LOW\_UTILIZATION}$ (`HIGH`)
  - Rate $< 50\% \implies \text{LOW\_UTILIZATION}$ (`MEDIUM`)
  - Rate $> 110\% \implies \text{OVER\_UTILIZATION}$ (`HIGH`)
- **State Peer Z-Score:**
  $$Z = \frac{\text{Rate} - \mu_{\text{state}}}{\sigma_{\text{state}}}$$
  Flagged as `FUND_UTILIZATION_ANOMALY` if $|Z| > 2.0$.
- **Temporal Shift:** Utilization drop between consecutive fiscal years $> 40\text{ percentage points} \implies \text{SUDDEN\_UTILIZATION\_SHIFT}$ (`HIGH`).

### 6.8 Suspicious Pattern Detector (`pattern_detection.py`)
- **Amount Clustering:** $\ge 5$ works in the same constituency and FY with identical rupee amounts $\implies \text{AMOUNT\_CLUSTERING}$ ($> 10\text{ works} \implies \text{HIGH}$, else $\text{MEDIUM}$).
- **End-of-Year March Rush:** For constituencies with $\ge 10$ works in a FY, if $\frac{\text{March Sanctions}}{\text{Total Sanctions}} > 0.40 \implies \text{END\_OF\_YEAR\_RUSH}$ ($> 0.60 \implies \text{HIGH}$, else $\text{MEDIUM}$).
- **Round Number Bias:** If $> 80\%$ of works in a FY are exact multiples of ₹1,00,000 $\implies \text{ROUND\_NUMBER\_BIAS}$ (`LOW`).
- **Agency Concentration:** If a single implementing agency captures $> 80\%$ of total sanctioned funds in a FY $\implies \text{AGENCY\_CONCENTRATION}$ (`MEDIUM`).

---

## 7. Hierarchical Risk Scoring & Radar Architecture

### 7.1 Work-Level Risk Formulation (`risk_scoring.py`)
1. **Legacy Base Sum ($0 - 100$):**
   $$\text{Base} = R_{\text{cost}} + R_{\text{delay}} + R_{\text{dup}} + R_{\text{pattern}} + R_{\text{util}}$$
   - $R_{\text{cost}} \in [0, 25]$ based on overrun bracket ($\le 0\% \to 0, \le 15\% \to 5, \le 30\% \to 15, \le 50\% \to 20, > 50\% \to 25$).
   - $R_{\text{delay}} \in [0, 25]$ based on delay days ($\le 0 \to 0, \le 90 \to 5, \le 180 \to 10, \le 365 \to 20, > 365 \to 25$).
   - $R_{\text{dup}} \in [0, 25]$ based on composite duplicate score ($> 70 \to 25, \ge 50 \to 15, < 50 \to 0$).
   - $R_{\text{pattern}} \in [0, 15]$ based on cluster/rush/agency dominance flags.
   - $R_{\text{util}} \in [0, 10]$ based on constituency fund utilization flags.

2. **6 Target Dimensions (Normalized $0 - 100$):**
   - $\text{Cost Risk} = \min(100, R_{\text{cost}} \times 4)$
   - $\text{Delay Risk} = \min(100, R_{\text{delay}} \times 4)$
   - $\text{Duplicate Risk} = \text{Composite Duplicate Score (or 0)}$
   - $\text{Payment Risk} = 100 \text{ (CRIT)}, 75 \text{ (HIGH)}, 50 \text{ (MED)}, 25 \text{ (LOW)}, 0 \text{ (None)}$
   - $\text{Compliance Risk} = 100 \text{ (CRIT)}, 75 \text{ (HIGH)}, 50 \text{ (MED)}, 25 \text{ (LOW)}, 0 \text{ (None)}$
   - $\text{Durability Risk} = 100 \text{ (CRIT)}, 75 \text{ (HIGH)}, 50 \text{ (MED)}, 25 \text{ (LOW)}, 0 \text{ (None)}$

3. **Composite Integration:**
   Let $M = \max(\text{Cost}, \text{Delay}, \text{Dup}, \text{Payment}, \text{Compliance}, \text{Durability})$.
   $$\text{Work Risk Score} = \begin{cases} 
   \min\left(100, \text{round}\left(M \times 0.60 + \text{Base} \times 0.40 + \text{Addons}\right)\right), & \text{if } M > 0 \\ 
   \min\left(100, \text{Base} + \text{Addons}\right), & \text{if } M = 0 
   \end{cases}$$
   *(Where $\text{Addons} = 0.15 \times \text{Payment} + 0.15 \times \text{Compliance} + 0.15 \times \text{Durability}$)*.

4. **Risk Tiers:**
   - `LOW`: $0 - 25$
   - `MEDIUM`: $26 - 50$
   - `HIGH`: $51 - 75$
   - `CRITICAL`: $76 - 100$

### 7.2 Constituency-Level Risk Index Formulation
For each constituency and financial year:
$$\text{Constituency Score} = \min\left(100, \max\left(5, \text{round}\left(\text{Baseline} + \text{Anomaly Impact} + \text{Fund Util Impact}\right)\right)\right)$$
Where:
- $\text{Baseline} = (\mu_{\text{work\_scores}} \times 0.65) + (\max(\text{work\_scores}) \times 0.20)$
- $\text{Anomaly Impact} = \left(\frac{\text{Works with Anomalies}}{\text{Total Works}}\right) \times 18.0$
- $\text{Fund Util Impact} = (\text{Fund Utilization Flag}) \times 6.0$

---

## 8. Role-Based Access Control (RBAC) & Security Architecture

### 8.1 RBAC Matrix (`app/auth/rbac.py`)

| User Role | Data Scope Boundary | Upload Data | User Admin | Triage Alerts | Export Reports | Configure Thresholds |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`ROLE_ADMIN`** | **National (ALL)** | Yes | Yes | Yes | Yes | Yes |
| **`ROLE_MINISTRY`** | **National (ALL)** | No | No | Yes | Yes | No |
| **`ROLE_STATE_NODAL`** | **State Level** (`scope_value`) | No | No | Yes | Yes | No |
| **`ROLE_DISTRICT`** | **District Level** (`scope_value`) | No | No | Yes | Yes | No |
| **`ROLE_MP`** | **Constituency Level** (`scope_value`) | No | No | No | Yes | No |
| **`PUBLIC`** *(Unauthenticated)* | **National Aggregates** | No | No | No | No | No |

### 8.2 Authentication & Cryptographic Standards
- **Token Format:** JWT signed with RS256 RSA private key (`keys/jwt_private.pem`) and verified with public key (`keys/jwt_public.pem`). Falls back gracefully to HS256 secret key if RSA keys are absent.
- **Token Lifespans:** Access Token = 30 minutes; Refresh Token = 7 days.
- **Token Revocation:** Managed via `refresh_tokens` database table. Logouts revoke active tokens immediately.
- **Account Lockout Guard:** Tracks consecutive failed login attempts in `users.failed_login_attempts`. 5 consecutive failures triggers an automatic 15-minute account lock (`users.locked_until`).
- **Rate Limiting:** Sliding-window in-memory filter enforcing 100 req/min per IP/User for API routes, and 5 req/min for `/api/v1/auth/login`.

---

## 9. Complete REST API Specifications & Routing Table

### 9.1 Authentication Router (`/api/v1/auth`)
- `POST /login`: Request `{username, password}` $\to$ Response `{access_token, refresh_token, token_type, expires_in, user}`.
- `POST /refresh`: Request `{refresh_token}` $\to$ Response `{access_token, token_type, expires_in}`.
- `POST /logout`: Invalidates active refresh token in database registry.
- `GET /me`: Returns profile of active authenticated user.

### 9.2 Works Router (`/api/v1/works`)
- `GET /`: Lists works. Query params: `page`, `per_page`, `constituency`, `constituency_id`, `state`, `district`, `financial_year`, `status`, `risk_tier`, `category`, `search`, `sort_by`, `sort_order`. Scoped by user territory.
- `GET /{work_id}`: Retrieves complete work record, 6-axis risk components, active anomaly flags, and XAI audit narrative.
- `GET /{work_id}/explanation`: Returns standalone deterministic XAI explanation object.
- `POST /`: Creates a new sanctioned work. Computes MiniLM-L6-v2 embeddings asynchronously, checks overrun, assigns risk tier, writes to `audit_log`.

### 9.3 Constituencies Router (`/api/v1/constituencies`)
- `GET /`: Lists constituencies with risk scores, work counts, total outlay, expenditure, fund utilization rate, and active anomaly count.
- `GET /{constituency_id}`: Detailed 360° dossier: historical risk scores, financial reconciliation timeline, radar chart components, duplicate work pairs, and full work ledger.

### 9.4 Anomalies Router (`/api/v1/anomalies`)
- `GET /`: Triage queue. Query params: `type`, `severity`, `status`, `constituency`, `state`, `page`, `per_page`.
- `GET /{anomaly_id}`: Deep forensic details of an anomaly and complete historical audit trail from `audit_log`.
- `PATCH /{anomaly_id}` / `PATCH /{anomaly_id}/status`: Updates status (`NEW`, `ACKNOWLEDGED`, `UNDER_REVIEW`, `RESOLVED`, `FALSE_POSITIVE`) and appends auditor notes. Logs mutation to `audit_log`.

### 9.5 Analytics Router (`/api/v1/analytics`)
- `GET /national-summary`: Returns national KPIs, risk distribution, anomaly breakdown, Top-10 high risk constituencies, and multi-year trends.
- `GET /official-metrics`: Returns official baseline metrics from `current_data.json` or live database reconciliation.
- `GET /state-summary/{state_name}`: State-level rollups, district-level breakdown tables, and constituent risk rankings.
- `GET /district-summary/{district_name}`: District-level project breakdowns and alert metrics.
- `GET /trends`: Time-series trends (`anomaly_count`, `avg_risk_score`, `fund_utilization`, `expenditure`) grouped by financial year.

### 9.6 Administration Router (`/api/v1/admin`)
- `POST /upload`: Uploads official MPLADS CSV datasets (up to 50MB). Validates 18 required schema headers, persists records, writes to `upload_history`, and triggers the detection pipeline in the background.
- `POST /run-detection`: Manually launches the detection pipeline via thread-locked worker.
- `POST /cancel-detection` / `POST /reset-stuck-runs`: Cancels stuck or orphaned detection runs.
- `GET /detection-runs`: Queries historical and active pipeline runs.
- `POST /reset-database`: Clears all works, expenditures, anomalies, and risk scores to zero state.
- `POST /seed-official-baseline`: Loads all 5 official MoSPI datasets and triggers pipeline execution.
- `POST /generate-synthetic`: Parametric synthesizer generating benchmark datasets with controlled anomaly injection rates.
- `GET /upload-history`: Retrieves list of recent CSV upload jobs and validation logs.

### 9.7 Reports Router (`/api/v1/reports`)
- `POST /generate`: Queues/generates PDF or CSV audit inspection reports with 300s TTL cache.
- `GET /csv`: Direct streaming download of tabular CSV report.
- `GET /pdf`: Direct streaming download of styled ReportLab PDF audit dossier.
- `GET /{report_id}/download`: Retrieves pre-generated cached report file.

### 9.8 AI Assistant Router (`/api/ai` & `/api/v1/ai`)
- `POST /chat`: Conversational interface backed by `openrouter_service.py`. Grounded with strict MoSPI baseline prompt and live dashboard UI context. Features multi-model automatic fallback across free-tier LLMs (`nex-n2.5-mini`, `nemotron-3.5-lightning`, `gemma-4-31b-it`).

---

## 10. Frontend Architecture, Pages & UI Components

### 10.1 Page Routes & Guards (`App.tsx`)
- `/` $\to$ `LandingPage`: Public-facing hero overview, key findings, login modal.
- `/login` $\to$ `LoginPage`: Quick role-selection demo login & credentials form.
- `/dashboard` $\to$ `NationalDashboardPage`: India risk map, national KPIs, multi-year charts.
- `/state` $\to$ `StateDashboardPage`: State overview, district rollups, constituency table (Guarded: `ROLE_ADMIN`, `ROLE_MINISTRY`, `ROLE_STATE_NODAL`, `ROLE_DISTRICT`, `ROLE_MP`).
- `/constituency/:id` $\to$ `ConstituencyDetailPage`: 6-Axis Radar, financial timeline, works ledger (Guarded).
- `/alerts` $\to$ `AlertManagementPage`: Anomaly triage queue with search, filtering, drawer (Guarded).
- `/admin` $\to$ `AdminPage`: Pipeline management, dataset seeding, CSV upload (Guarded: `ROLE_ADMIN`).

### 10.2 Component Hierarchy & Responsibilities
- `AppLayout.tsx`: Top navbar, responsive sidebar, role indicator, theme switch, user avatar menu.
- `IndiaMap.tsx`: Interactive SVG choropleth mapping all 36 States/UTs. Color-coded by average risk index. Hover displays expenditure/anomalies; click filters the State Dashboard.
- `InvestigationDrawer.tsx`: Slide-over audit drawer displaying work details, 6-risk radar breakdown, and plain-English XAI investigative narrative.
- `DuplicatePairsCard.tsx`: Side-by-side comparison view for suspected duplicate works showing token overlap %, budget diff %, and geodesic distance.
- `KPICard.tsx`: Metric card with icons, badge, custom gradient background.
- `ReportExportModal.tsx`: Scope selector (National/State/Constituency), format selector (PDF/CSV), FY selector.
- `AIChatbotModal.tsx`: Floating button, message list, user input, context injection, typing indicators.
- `ThemeToggle.tsx`: Theme toggle button.
- `RiskBadge.tsx`: Risk tier badge colors (`LOW` $\to$ Green, `MEDIUM` $\to$ Blue, `HIGH` $\to$ Amber, `CRITICAL` $\to$ Red).
- `AddWorkModal.tsx`: Modal form to add a work entry.
- `WorkDetailDrawer.tsx`: Detail drawer.

---

## 11. Synthetic Data Generator Specification (`synthetic_generator.py`)

Produces realistic benchmark datasets across all 34 tracked Indian States/UTs (Andaman and Nicobar Islands is intentionally kept untracked to test missing data edge cases):
- **Tier 1 (High/Critical predisposition):** Bihar, Uttar Pradesh, West Bengal, Jharkhand, Punjab.
- **Tier 2 (Medium/High predisposition):** Maharashtra, Rajasthan, Madhya Pradesh, Haryana.
- **Tier 3 (Nominal baseline):** Gujarat, Karnataka, Tamil Nadu, Andhra Pradesh, Kerala, Telangana, Odisha.
- **Tier 4 (Hilly / Remote):** Himachal Pradesh, Uttarakhand, Jammu & Kashmir, Ladakh, Goa, Sikkim.
- **Tier 5 (North-East & UTs):** Assam, Meghalaya, Manipur, Mizoram, Nagaland, Tripura, Arunachal Pradesh, Chandigarh, Delhi, Puducherry, Dadra & Nagar Haveli, Lakshadweep.
- **Anomaly Injection Controls:** Parametric scaling allows injecting cost overruns (15–80%), milestone delays (90–500 days), lexical duplicate pairs, and premature disbursements at exact user-specified ratios ($0.0 - 0.50$).

---

## 12. Automated Test Suite & Verification Matrix

Located in `backend/tests/`:
- `test_anomaly_detection.py`: Verifies overrun thresholds, delay brackets, duplicate cosine similarity gates, and pattern clustering rules.
- `test_detector_golden.py`: Golden test assertions ensuring zero false negatives on known synthetic-injected anomalies (golden set).
- `test_risk_scoring.py`: Validates mathematical boundaries of work-level (0–100) and constituency-level scoring.
- `test_rbac.py`: Asserts 403 Forbidden enforcement on cross-state and cross-district scoping violations.
- `test_security_hardened.py`: Verifies sliding-window rate limiting and account lockout after 5 failed attempts.
- `test_api.py` & `test_auth.py`: End-to-end integration tests on login, token rotation, and CRUD operations.

---

## 13. Deployment, Infrastructure & Production Readiness

### 13.1 Docker Compose Setup (`docker-compose.yml`)
- `db`: `pgvector/pgvector:pg16` on port 5432 with health check.
- `redis`: `redis:7-alpine` on port 6379 with health check.
- `backend`: Custom Dockerfile (Python 3.11), port 8000. Mounts `/reports` and `/data`.
- `frontend`: Custom Dockerfile (Node build + Nginx alpine), port 80. Proxies `/api` to backend container.

### 13.2 Environment Variables Reference (`.env`)
```ini
DATABASE_URL=postgresql+asyncpg://mplads:mplads_secure_password@db:5432/mplads_sentinel
SYNC_DATABASE_URL=postgresql://mplads:mplads_secure_password@db:5432/mplads_sentinel
REDIS_URL=redis://redis:6379/0
JWT_PRIVATE_KEY_PATH=keys/jwtRS256.key
JWT_PUBLIC_KEY_PATH=keys/jwtRS256.key.pub
ENVIRONMENT=production
LOG_LEVEL=INFO
API_RATE_LIMIT=100
LOGIN_RATE_LIMIT=5
MAX_UPLOAD_SIZE_MB=50
DEV_DEMO=false
EXTERNAL_EXPLANATION_ENABLED=false
REFERENCE_DATE=
OPENROUTER_API_KEY=
```

---

## 14. Architectural Gaps, Edge Cases & Recommended AI Modifications

*(Structured specifically for Analysis AI consumption and optimization proposal generation)*

### 14.1 Bottlenecks & Recommended Modifications
1. **In-Process Thread Mutex for Pipeline Runs:**
   - *Current State:* Anomaly detection runs synchronously inside the FastAPI process within a Python worker thread guarded by an in-memory `threading.Lock` (`_PIPELINE_LOCK`).
   - *Risk:* In a multi-worker production deployment (`uvicorn -w 4` or Gunicorn), in-memory threading locks fail across separate OS worker processes, leading to race conditions and duplicate pipeline executions.
   - *Recommended AI Modification:* Migrate pipeline task dispatching to **Celery** or **ARQ** with Redis-backed distributed locks (`redis-py` distributed mutex / Redlock).

2. **In-Memory Rate Limiting:**
   - *Current State:* Rate limiting uses an in-memory dictionary tracking timestamps in `app/auth/rate_limit.py`.
   - *Risk:* Rate limits reset on server restarts and cannot be shared across clustered FastAPI instances.
   - *Recommended AI Modification:* Transition rate limiting to Redis sliding window sorted sets (`ZSET`).

3. **Database Environment Divergence (SQLite vs PostgreSQL):**
   - *Current State:* Development environment utilizes SQLite with WAL pragmas (`mplads.db`), while production targets PostgreSQL 16 with `pgvector`.
   - *Risk:* Certain queries (such as vector distance operators `<=>`, ILIKE pattern matching, and concurrent write locks) behave differently under high concurrency. SQLite locks on write when bulk inserting duplicate pairs.
   - *Recommended AI Modification:* Enforce a unified PostgreSQL containerized environment across both development and production.

4. **Pairwise Duplicate Detection Complexity:**
   - *Current State:* Pairwise duplicate detection computes cosine similarity across all combinations within a constituency ($O(N^2)$ per constituency). If a constituency has $> 2,000$ works, dense matrix multiplications strain memory.
   - *Recommended AI Modification:* Utilize `pgvector` HNSW index (`USING hnsw (description_embedding vector_cosine_ops)`) to execute approximate nearest neighbor (ANN) vector queries directly in the database (`SELECT * FROM works ORDER BY description_embedding <=> target LIMIT 10`), bypassing memory-heavy pairwise matrix products.

5. **LLM Secret Handling in OpenRouter Service:**
   - *Current State:* `_DEFAULT_KEY` is stored as a base64-encoded string in `openrouter_service.py` to prevent static scanner triggers.
   - *Risk:* Hardcoded fallback API keys in source code represent a security exposure in open repositories.
   - *Recommended AI Modification:* Require `OPENROUTER_API_KEY` strictly via environment variables or secrets manager, failing gracefully to local deterministic explanation mode when absent.

---
*End of Technical Specification — PRAHAR System Architecture & Workflow Document.*
