# PRAHAR: AI-Powered Audit & Anomaly Detection System for MPLADS
> **Smart India Hackathon (SIH 2026)**  
> **Problem Statement:** AI-Powered Anomaly Detection & Risk Scoring for MPLADS Scheme  
> **Repository:** `PRAHAR-SIH-2026` / `MPLADS Sentinel`

---

## 1. Executive Summary & Solution Vision

**PRAHAR** is an enterprise-grade, explainable AI auditing platform designed to bring total transparency, financial integrity, and automated oversight to the **MPLADS (Member of Parliament Local Area Development Scheme)** across India's 543 Parliamentary Constituencies.

Managing thousands of distributed civil infrastructure projects (roads, drinking water facilities, schools, hospitals, community centres) poses major governance challenges:
- **Budget Leakages & Cost Overruns**: Actual spending routinely balloons past sanctioned budgets without administrative revisions.
- **Milestone Delays & Ghost Projects**: Sanctioned projects stalling for years or completing with severe calendar breaches.
- **Duplicate & Overlapping Allocations**: Identical or near-identical works sanctioned repeatedly under subtle linguistic alterations across consecutive fiscal years.
- **Premature Disbursements & Chronological Anomalies**: Disbursing 80%+ funds when physical progress is less than 10%, or logging completion dates that predate sanctions.
- **Data Fragmentation**: Oversight authorities lack unified visibility from national macro-aggregates down to work-level geo-coordinates.

### Core Philosophy: *Data → Insights → Accountability*
Unlike opaque "black-box" systems, PRAHAR enforces **deterministic, auditable mathematical risk scoring (0–100)** corroborated by **unsupervised machine learning (Isolation Forests)**, **state-of-the-art semantic NLP (Sentence-Transformers MiniLM-L6-v2)**, and an **LLM Explanation Layer (Claude / GenAI)** that synthesizes multidimensional risk signals into human-readable investigative memos for field auditors.

---

## 2. The 7-Step Technical Approach Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       PRAHAR TECHNICAL WORKFLOW                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
   [01] MPLADS Data Collection
        ├── Project Details (IDs, Descriptions, Categories, Work Status)
        ├── Financial Records (Sanctioned Amounts, Actual Expenditures, Cost Overruns)
        ├── Progress & Milestone Timelines (Sanction Date, Target Date, Completion Date)
        └── Geo-Spatial & Inspection Logs (Latitude, Longitude, Implementing Agencies)
                            │
                            ▼
   [02] Data Cleansing & Processing
        ├── Missing Value Imputation & Schema Normalization (Z-Score sanitization)
        ├── Geo-Coordinate Validation (WGS-84 Indian bounds validation)
        └── Text Preprocessing (Tokenization, Case-folding, Stopword pruning)
                            │
                            ▼
   [03] AI + Rule-Based Hybrid Engine
        ├── Statistical Z-Scores vs Peer Work Categories
        ├── Unsupervised Multivariate Anomaly Detection (Isolation Forest)
        └── Dense Semantic Embeddings (Sentence Transformers all-MiniLM-L6-v2)
                            │
                            ▼
   [04] 6 Multi-Dimensional Risk Checks
        ├── 1. Cost Risk (Overrun thresholds >15%, 30%, 50% + IsoForest Outliers)
        ├── 2. Delay Risk (90/180/365-day milestone breach + Stalled ongoing projects)
        ├── 3. Payment Risk (Premature 80%+ disbursement on not-started/stalled works)
        ├── 4. Duplicate Detection (Pairwise NLP Cosine Sim > 0.85 + Jaccard >= 0.70 + Geo 2km)
        ├── 5. Compliance Risk (Chronological inverted dates + Unmapped generic agencies)
        └── 6. Durability / Asset Quality Risk (Premature repeat repairs within 365 days)
                            │
                            ▼
   [05] Explainable Composite Risk Score (0–100)
        ├── Deterministic, weighted mathematical formula across all 6 risk dimensions
        ├── Risk Tiering: LOW (0–25) | MEDIUM (26–50) | HIGH (51–75) | CRITICAL (76–100)
        └── Zero hallucination: Exact mathematical components and rule IDs mapped to database
                            │
                            ▼
   [06] Prioritized High-Risk Projects & Multi-Level Dashboards
        ├── National Risk Choropleth Map (State-by-state risk gradient & aggregate outlay)
        ├── State Comparative Console (Top anomalous constituencies & district tiers)
        ├── Constituency 360° Dossier (Radar chart, Financial timeline, Duplicate pairs)
        └── Alert Triage Queue (Filters by Severity, Anomaly Type, Status, Constituency)
                            │
                            ▼
   [07] Authority Verification & LLM Investigation Layer
        ├── Human-in-the-Loop Audit Workflow (NEW → ACKNOWLEDGED → UNDER_REVIEW → RESOLVED)
        └── LLM Explanation Layer: Generates plain-English narrative dossiers with evidence breakdown
```

---

## 3. In-Depth AI / ML Models & Mathematical Formulations

### 3.1. NLP Semantic Similarity Engine (Duplicate Work Detection)
- **Model**: `sentence-transformers/all-MiniLM-L6-v2` (PyTorch / HuggingFace).
- **Architecture**: 6-layer MiniLM Transformer producing 384-dimensional dense vectors with mean pooling and L2 normalization.
- **Fallback**: TfidfVectorizer with n-grams `(1, 2)` when PyTorch/GPU resources are constrained.
- **Mathematical Pipeline**:
  1. **Dense Cosine Similarity**:
     $$\text{Cosine}(u, v) = \frac{u \cdot v}{\|u\|_2 \|v\|_2} = u \cdot v \quad (\text{since vectors are } L_2 \text{-normalized})$$
  2. **Lexical Jaccard Overlap**:
     $$J(A, B) = \frac{|T_A \cap T_B|}{|T_A \cup T_B|}$$
     *(Pruned of 17 common syntactic function words such as `at`, `in`, `for`, `the` to prevent preposition substitutions from masking duplicate civil works).*
  3. **Multi-Attribute Composite Duplicate Score ($0 - 100$)**:
     $$\text{Duplicate Score} = (\text{Cosine} \times 40) + (S_{\text{amount}} \times 20) + (S_{\text{temporal}} \times 15) + (S_{\text{geo}} \times 15) + S_{\text{cat}}$$
     - Amount Similarity: $S_{\text{amount}} = \max\left(0, 1 - \frac{|A_1 - A_2|}{\max(A_1, A_2)}\right)$
     - Temporal Proximity: $S_{\text{temporal}} = \max\left(0, 1 - \frac{|\text{Date}_1 - \text{Date}_2|}{365}\right)$
     - Geo Proximity ($S_{\text{geo}}$): Uses Haversine Great-Circle Geodesic Distance:
       $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos \phi_1 \cos \phi_2 \sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
       Score evaluates to $\max(0, 1 - d / 2.0)$ (full 15 points within 2 km).
     - Category Match: $S_{\text{cat}} = 10$ if both works share the same work category, else $0$.
  4. **Corroboration Thresholds**:
     - Score $\ge 70$: Flagged as `HIGH` severity duplicate pair.
     - Score $50 - 69$: Flagged as `MEDIUM` severity duplicate pair (requires geographic proximity $\le 2\text{ km}$).

---

### 3.2. Unsupervised Outlier Detection (Isolation Forest)
- **Algorithm**: `sklearn.ensemble.IsolationForest`
- **Application**: Detects multivariate anomalies across spending, sanctioned amounts, and duration metrics that evade simple single-variable cutoff rules.
- **Feature Vector per Work**:
  $$X = [\text{sanctioned\_amount}, \text{actual\_expenditure}, \text{overrun\_pct}, \text{duration\_days}, \text{cost\_per\_day}]$$
- **Hyperparameters**:
  - `n_estimators = 100` isolation trees
  - `contamination = 0.05` (top 5% extreme multidimensional outliers)
  - `random_state = 42` (reproducible deterministic benchmarks)
- **Isolation Path Logic**: Anomalies require substantially fewer random recursive splits to isolate in feature space compared to nominal works, yielding negative anomaly decision scores:
  $$s(x, n) = 2^{-\frac{E(h(x))}{c(n)}}$$

---

### 3.3. Statistical Peer Benchmarking (Z-Score Normalization)
- **Application**: Cost Overrun evaluation relative to historical works in the **exact same category** (e.g., *Drinking Water* vs. *Roads & Bridges* vs. *Community Halls*).
- **Formula**:
  $$Z = \frac{\text{overrun\_pct} - \mu_{\text{category}}}{\sigma_{\text{category}}}$$
- **Trigger**: Flagged as `ZSCORE` anomaly if $|Z| > 2.5$ ($\approx 99.38\%$ confidence under normal distribution).

---

### 3.4. Temporal Clustering (Rush Spending / Fiscal Year-End Surges)
- **Algorithm**: Grouped rolling expenditure analysis.
- **Logic**: Evaluates whether $>40\%$ of an entire constituency's annual expenditure was disbursed in the final month of the fiscal year (March), flagging potential rush utilization to prevent fund lapsing.

---

### 3.5. Composite Work & Constituency Risk Scoring Formulas
- **Work-Level Composite Risk (0–100)**:
  $$\text{Work Risk Score} = \min\left(100, R_{\text{cost}} + R_{\text{delay}} + R_{\text{dup}} + R_{\text{pattern}} + R_{\text{util}}\right)$$
  - $R_{\text{cost}}$: Up to 25 pts (overrun $\le 15\% \to 5$, $\le 30\% \to 15$, $\le 50\% \to 20$, $> 50\% \to 25$)
  - $R_{\text{delay}}$: Up to 25 pts (delay $\le 90\text{d} \to 5$, $\le 180\text{d} \to 10$, $\le 365\text{d} \to 20$, $> 365\text{d} \to 25$)
  - $R_{\text{dup}}$: Up to 25 pts (composite duplicate score $> 70 \to 25$, $\ge 50 \to 15$)
  - $R_{\text{pattern}}$: Up to 15 pts (suspicious payment or agency cluster)
  - $R_{\text{util}}$: Up to 10 pts (underutilization or extreme utilization ratio)

- **Constituency-Level Risk Index (0–100)**:
  $$\text{Constituency Score} = \min\left(100, (\overline{\text{Work Risk}} \times 0.40) + \left(\frac{N_{\text{high\_risk}}}{N_{\text{total}}} \times 100 \times 0.35\right) + (\text{Fund Anomaly} \times 25)\right)$$

---

### 3.6. LLM Explanation Layer (Audit Narrative Synthesis)
- **Engine**: Anthropic Claude API / Local deterministic synthesis fallback (`explanations.py`).
- **Core Principle**: **Auditable Evidence-First**. The LLM is **never** permitted to generate or tamper with the numeric risk score. It receives structured factual evidence (rule IDs, overrun %, delay days, token overlap %, payment ratios) and formats an executive investigative memo:
  ```json
  {
    "work_id": "WRK-MH-PUN-0042",
    "score": 87,
    "tier": "CRITICAL",
    "summary": "Work WRK-MH-PUN-0042 is classified under CRITICAL risk (87/100) driven by 2 analytical flags: Actual expenditure exceeded sanctioned budget by 64.2%. Project is delayed by 412 days past expected milestone.",
    "key_reasons": [
      "Actual expenditure (₹2,463,000) exceeded sanctioned budget (₹1,500,000) by 64.2%.",
      "Project is delayed by 412 days past expected milestone (2025-07-24).",
      "Disbursement ratio 0.95 with work status IN_PROGRESS indicates premature fund depletion."
    ],
    "generator": "DETERMINISTIC_LOCAL"
  }
  ```

---

## 4. Tech Stack Specification

| Tier | Technologies | Purpose in PRAHAR |
| :--- | :--- | :--- |
| **Frontend** | **React 18, TypeScript, Vite** | Ultra-responsive Single Page Application |
| **UI Components** | **Ant Design (AntD), Lucide Icons** | Government enterprise-grade dashboard aesthetics |
| **Data Viz** | **Recharts, Custom SVG Geo Choropleth** | Interactive India risk map, Donut distributions, Radar charts |
| **Backend API** | **Python 3.11+, FastAPI, Uvicorn, Pydantic v2** | High-performance asynchronous REST microservices |
| **ORM & DB** | **SQLAlchemy 2.0 (Async + Sync), SQLite / PostgreSQL** | ACID transaction management, connection pooling, and migrations |
| **AI / ML & Stats** | **Scikit-Learn, NumPy, Pandas, SciPy** | Isolation Forests, Z-Score distribution, temporal clustering |
| **NLP & Vectors** | **Sentence-Transformers (`all-MiniLM-L6-v2`), PyTorch** | 384-dimensional dense semantic embedding duplicate detection |
| **Security & RBAC**| **PyJWT (RS256/HS256), Passlib (Bcrypt)** | Role-Based Access Control across 6 administrative tiers |

---

## 5. End-to-End Directory Architecture

```
SIH102/
├── backend/
│   ├── app/
│   │   ├── api/                           # REST Endpoint Routers
│   │   │   ├── admin.py                   # Ingestion, CSV upload, synthetic data, detection trigger
│   │   │   ├── analytics.py               # National summary, state summary, trends, KPIs
│   │   │   ├── anomalies.py               # Alert query, filtering, patch status (triage)
│   │   │   ├── auth.py                    # JWT login, refresh tokens, user profile
│   │   │   ├── constituencies.py          # Constituency dossiers, risk scores, work lists
│   │   │   ├── reports.py                 # PDF & CSV audit report generation
│   │   │   └── works.py                   # Individual work ledger, search, details
│   │   ├── auth/                          # Security & Permissions
│   │   │   ├── jwt_handler.py             # Token generation, decoding, expiry verification
│   │   │   ├── password.py                # Bcrypt password hashing
│   │   │   ├── rate_limit.py              # In-memory sliding window rate limiter
│   │   │   └── rbac.py                    # 6-Role permission matrix & constituency data scoping
│   │   ├── database.py                    # Async & Sync SQLAlchemy session factories
│   │   ├── models.py                      # Database models (Works, Anomalies, DuplicatePairs, etc.)
│   │   ├── schemas.py                     # Pydantic v2 validation schemas
│   │   └── services/                      # Analytical Core & Business Logic
│   │       ├── anomaly_detection/         # The 6 Anomaly Detectors
│   │       │   ├── cost_overrun.py        # Z-Score + Threshold + Isolation Forest
│   │       │   ├── delay_detection.py     # Milestone tiering (90/180/365 days)
│   │       │   ├── duplicate_detection.py # NLP Sentence Transformers + Jaccard + Geo
│   │       │   ├── payment_detection.py   # Premature fund exhaustion rules
│   │       │   ├── compliance_detection.py# Chronological & agency validation rules
│   │       │   ├── durability_detection.py# Repeat repair & asset quality detection
│   │       │   ├── fund_utilization.py    # State-normalized expenditure benchmarks
│   │       │   ├── pattern_detection.py   # Agency concentration & rush spending
│   │       │   └── pipeline.py            # Orchestrates all 6 detectors in sequence
│   │       ├── analytics.py               # Aggregates national/state summary statistics
│   │       ├── data_ingestion.py          # Robust CSV parsing, sanitization, validation
│   │       ├── embeddings.py              # MiniLM-L6-v2 vectorization singleton service
│   │       ├── explanations.py            # Generates auditable narrative summaries
│   │       ├── report_generator.py        # Generates formal PDF audit inspection dossiers
│   │       ├── risk_scoring.py            # Work-level and constituency-level composite scoring
│   │       └── synthetic_generator.py     # Benchmarking dataset synthesizer with injected anomalies
│   ├── mplads_sentinel.db                 # SQLite local database (543 constituencies)
│   ├── requirements.txt                   # Backend Python dependencies
│   └── tests/                             # Pytest automated test suite
│
├── frontend/
│   ├── src/
│   │   ├── api/                           # Axios API client integrations
│   │   │   ├── admin.ts                   # Trigger detection, upload CSV, reset database
│   │   │   ├── analytics.ts               # National summary, state summary, trends
│   │   │   ├── anomalies.ts               # Alert filtering and status update
│   │   │   ├── auth.ts                    # User login and profile
│   │   │   ├── client.ts                  # Axios interceptor with bearer token injection
│   │   │   ├── constituencies.ts          # Constituency risk listings and details
│   │   │   └── works.ts                   # Work ledger queries
│   │   ├── components/                    # Modular Reusable React UI Components
│   │   │   ├── AppLayout.tsx              # Top navigation bar, responsive sidebar, user menu
│   │   │   ├── DuplicatePairsCard.tsx     # Comparison view for suspected duplicate works
│   │   │   ├── IndiaMap.tsx               # Interactive SVG choropleth of Indian states
│   │   │   ├── InvestigationDrawer.tsx    # Slide-over audit drawer with LLM explanation
│   │   │   ├── KPICard.tsx                # Metric KPI card with custom gradients
│   │   │   └── RiskBadge.tsx              # Standardized risk tag (LOW, MED, HIGH, CRIT)
│   │   ├── context/                       # React Context Providers
│   │   │   └── AuthContext.tsx            # Global auth state, role checks, token persistence
│   │   ├── pages/                         # Core Application Views
│   │   │   ├── AdminPage.tsx              # Pipeline orchestration, CSV upload, benchmark generator
│   │   │   ├── AlertManagementPage.tsx    # Anomaly triage queue with search & filters
│   │   │   ├── ConstituencyDetailPage.tsx # 360° constituency risk radar, works table, timeline
│   │   │   ├── LoginPage.tsx              # Role-selectable quick login & credentials
│   │   │   ├── NationalDashboardPage.tsx  # Executive overview with map, KPIs, bar charts
│   │   │   └── StateDashboardPage.tsx     # State-level breakdown of all constituencies
│   │   ├── types/                         # TypeScript interfaces and type definitions
│   │   ├── App.tsx                        # Client-side routes & ProtectedRoute guards
│   │   └── main.tsx                       # React application entry point
│   ├── package.json                       # Frontend dependencies & npm scripts
│   └── vite.config.ts                     # Vite build and proxy configuration
```

---

## 6. Role-Based Access Control (RBAC) Matrix

PRAHAR strictly enforces role-based access control (RBAC) at both the API endpoint layer and UI layer:

| User Role | Persona | Permissions & Visible Data Scope |
| :--- | :--- | :--- |
| **`ROLE_ADMIN`** | System Administrator | Full unrestricted national access; Trigger detection pipeline; Ingest CSV records; Reset database; Manage users. |
| **`ROLE_MINISTRY`** | MoSPI National Officer | National-level overview; All 36 States/UTs; Export official audit reports; Review national anomaly trends. |
| **`ROLE_STATE_NODAL`** | State Nodal Authority | Scoped strictly to their designated State (e.g. *Maharashtra*); View all constituencies within their state; Manage state alerts. |
| **`ROLE_DISTRICT`** | District Collector / DDA | Scoped strictly to their District (e.g. *Pune*); Investigate alerts; Update anomaly statuses; Verify field inspection documents. |
| **`ROLE_MP`** | Member of Parliament | Scoped strictly to their Constituency (e.g. *Pune Lok Sabha*); View constituency project progress, financial timeline, and radar scores. |
| **`ROLE_PUBLIC`** | Citizen / Public Viewer | Transparency dashboard; High-level national & state aggregate statistics, choropleth maps, and anomaly totals; **Work-level confidential details & alert queues are hidden** *(AC-AAA-002-04 compliant)*. |

---

## 7. Key Features Breakdown

### 1. National Executive Dashboard
- **Live KPI Counter**: Total Sanctioned Works, Actual Expenditure (₹ Cr), High-Risk Constituencies count, Active Flagged Anomalies.
- **Interactive India Risk Choropleth Map**: Dynamic SVG map color-coded by average risk index across all 36 States/UTs. Hover reveals state summary; click instantly filters the State Dashboard.
- **Top-10 Highest Risk Constituencies Bar Chart**: Visualizes the most critical constituencies nationwide with direct click-through to dossiers.
- **Donut Distribution**: Breakdown of anomalies across the 6 core risk categories.
- **Multi-Year Financial Trends**: Line chart showing anomaly counts across consecutive Financial Years (`2019-20` to `2024-25`).

### 2. State & Regional Comparative Console
- State selector dropdown covering all Indian States and Union Territories.
- District-level aggregation table displaying total works, expenditure, fund utilization rate (%), and active anomaly count.
- Searchable constituency table with color-coded risk badges.

### 3. Constituency 360° Dossier
- **6-Axis Risk Radar Chart**: Visualizes Cost Risk, Delay Risk, Payment Risk, Duplicate Risk, Compliance Risk, and Durability Risk.
- **Financial Reconciliation Timeline**: Bar/line chart comparing annual Fund Releases vs. Actual Expenditure over fiscal years.
- **Works Ledger Table**: Searchable, sortable table of all sanctioned works with pagination, category filter, and status tags.
- **Suspected Duplicate Work Viewer**: Side-by-side card comparing Work A and Work B with token similarity %, amount diff %, and geographic distance.

### 4. Alert Management & Triage Queue
- Centralized anomaly workbench for district authorities and auditors.
- Filter by Severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), Status (`NEW`, `ACKNOWLEDGED`, `UNDER_REVIEW`, `RESOLVED`), and Anomaly Type.
- In-place status update workflow with audit notes.

### 5. Investigation Drawer with Explainable AI (XAI)
- Click any work reference to open a sliding investigation drawer.
- Shows project details, financial outlay, timeline, and location.
- **LLM Explanation Card**: Displays an automated plain-English investigative narrative explaining *why* the work was flagged, exact numeric triggers, and confidence score.

### 6. Pipeline Administration & Synthetic Benchmarking
- **Run Full Detection Pipeline**: Orchestrates all 6 detectors in sequence with real-time progress indicator, elapsed timer, and stage descriptions.
- **CSV Data Ingestion**: Drag-and-drop official MPLADS CSV datasets (validates 18 required schema columns).
- **Synthetic Data Generator**: Parametric synthesizer to generate realistic benchmark datasets (e.g., 543 constituencies, 1,000+ works, custom anomaly injection rates) for stress testing.

---

## 8. Hackathon Presentation & Pitch Guide

### 8.1. 30-Second Elevator Pitch
> *"Over ₹4,000 Crores are allocated annually under MPLADS for local public infrastructure, yet manual auditing cannot track tens of thousands of projects spread across 543 constituencies. **PRAHAR** is an AI-powered surveillance radar that analyzes project text, budgets, geo-coordinates, and milestones in real time. Using Sentence-Transformers, Isolation Forests, and deterministic risk modeling, PRAHAR identifies cost leaks, phantom delays, and duplicate works, and uses an LLM layer to deliver plain-English investigative memos to field officers. PRAHAR transforms raw government data into immediate civic accountability."*

---

### 8.2. Key Differentiators to Highlight to Judges
1. **Explainable AI (XAI) vs. Black Box**:
   - *Judges often ask*: "How do auditors trust your ML model?"
   - *Answer*: "PRAHAR follows an **Evidence-First** rule. The numeric risk score is 100% deterministic and auditable from verifiable thresholds and statistical equations. Machine learning (Sentence-Transformers and Isolation Forests) acts as an evidentiary signal. The LLM only translates structured evidence into human language—it never invents scores."
2. **True Multimodal Cross-Checking (The 6 Risk Dimensions)**:
   - Not just text matching, and not just budget tracking. PRAHAR correlates **Text Semantics + Geodesic Coordinates + Temporal Sanction Windows + Expenditure Ratios + Chronological Consistency**.
3. **Enterprise Government RBAC**:
   - Compliant with official data governance: Public citizens get full aggregate transparency without accessing confidential contractor or work-level audit queues, while District Collectors have targeted triage authority.
4. **Resilient Local Deployment**:
   - Fully functional offline or in air-gapped government servers with local SQLite/Postgres and on-device NLP embeddings—no mandatory reliance on external paid APIs.

---

## 9. Quick-Start Guide (Running Locally)

### Prerequisites
- Python 3.10+ (with virtual environment)
- Node.js 18+ and npm

### Backend Setup
```bash
# 1. Navigate to backend directory
cd backend

# 2. Activate virtual environment
venv\Scripts\activate      # Windows
# source venv/bin/activate # Linux / macOS

# 3. Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
*Backend API docs available at: `http://localhost:8000/api/v1/docs`*

### Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Start Vite development server
npm run dev
```
*Frontend UI available at: `http://localhost:5173`*

### Demo User Accounts
| Username | Password | Role |
| :--- | :--- | :--- |
| `admin` | `Admin@1234` | System Administrator |
| `ministry_user` | `Ministry@1234` | MoSPI National Officer |
| `state_user` | `State@1234` | State Nodal Authority (Maharashtra) |
| `district_user` | `District@1234` | District Authority (Pune) |
| `mp_user` | `Mp@12345` | Member of Parliament (Pune) |
| `public_user` | `Public@1234` | Public Viewer (Citizens) |

---
*Created for Smart India Hackathon 2026 • Project PRAHAR • Team MPLADS Sentinel*
