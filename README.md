# MPLADS Sentinel (SIH-26102)
> **AI-Powered Automated Audit & Anomaly Detection System for MPLADS Projects**  
> *Built for the Ministry of Statistics and Programme Implementation (MoSPI)*

---

## 🏛️ System Architecture

MPLADS Sentinel provides end-to-end oversight, AI anomaly detection, and automated risk scoring across 543 Parliamentary Constituencies.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 + Vite + AntD 5                        │
│   (Offline Leaflet Choropleth, Recharts Radar/Trends, Audit Workflow)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ /api/v1 (JWT RS256)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    FastAPI Async Application Core                      │
│   - JWT RS256 Auth & 6-Role Hierarchical RBAC                         │
│   - In-memory Sliding Window Rate Limiting & Account Lockout Guard    │
│   - Multi-format Report Generator (PDF + CSV)                         │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
┌───────────────────▼────────────────┐   ┌───────────▼───────────────────┐
│   PostgreSQL 16 + pgvector         │   │   AI & Statistical Detectors  │
│   (Vector embeddings, Work items,  │   │   1. Cost Overruns (Z+IsoFor) │
│    Audit logs, Detection history)  │   │   2. Project Delays & Stalls  │
└────────────────────────────────────┘   │   3. Duplicates (MiniLM+Jac)  │
                                         │   4. Suspicious Pattern Rush  │
                                         │   5. Fund Utilization Shifts  │
                                         └───────────────────────────────┘
```

---

## 👥 Seed Demo User Accounts

The system comes pre-configured with 6 seed accounts representing every level of administrative hierarchy:

| Username | Password | Role | Data Scope | Allowed Views |
| :--- | :--- | :--- | :--- | :--- |
| **`admin`** | `Admin@1234` | `ROLE_ADMIN` | **National** | Full system access, data ingestion, pipeline triggers |
| **`ministry_user`** | `Ministry@1234` | `ROLE_MINISTRY` | **National** | National dashboards, state overviews, read/review |
| **`state_user`** | `State@1234` | `ROLE_STATE_NODAL` | **Maharashtra** | Maharashtra state & constituent projects |
| **`district_user`** | `District@1234` | `ROLE_DISTRICT` | **Pune District** | Pune district projects & anomaly transitions |
| **`mp_user`** | `Mp@12345` | `ROLE_MP` | **Pune** | Pune constituency works & expenditure radar |
| **`public_user`** | `Public@1234` | `ROLE_PUBLIC` | **Public** | High-level national & state summaries |

---

## 🔬 Anomaly Detection Methodologies

1. **Cost Overrun Detector (`app/services/anomaly_detection/cost_overrun.py`)**:
   - Threshold filter: actual expenditure $> 15\%$ over sanctioned budget.
   - Category-specific Z-score test ($|z| > 2.5$).
   - Multi-dimensional Isolation Forest enrichment (combining overrun percentage, duration, absolute cost).

2. **Project Delay & Stalling Detector (`app/services/anomaly_detection/delay_detection.py`)**:
   - Tiers: Minor (90–180 days), Moderate (180–365 days), Severe ($> 365$ days overdue).
   - Stalled Work Detection: Status is `IN_PROGRESS` or `SANCTIONED` with zero expenditure after $> 180$ days.

3. **Semantic Duplicate Work Detector (`app/services/anomaly_detection/duplicate_detection.py`)**:
   - Sentence-Transformers `all-MiniLM-L6-v2` embeddings (384-dimensional dense vectors).
   - Cosine Similarity $> 0.85$ + Stopword-aware Jaccard token overlap $> 0.60$.
   - Temporal & Budget filters ($\pm 180$ days sanction window, $\pm 20\%$ cost parity).
   - Dual-tier confidence rating enriched by geospatial proximity.

4. **Suspicious Patterns Detector (`app/services/anomaly_detection/pattern_detection.py`)**:
   - **Amount Clustering**: $\ge 5$ works with identical rupee amounts within the same FY.
   - **End-of-Year Rush**: $> 50\%$ (or $\ge 60\%$ high severity) of FY sanctions concentrated in March.
   - **Round Number Bias**: Significant clustering at exact lakh/crore thresholds.
   - **Agency Concentration**: Single implementing agency receiving $> 70\%$ of all works.

5. **Fund Utilization Discrepancy Detector (`app/services/anomaly_detection/fund_utilization.py`)**:
   - Utilization Rate: $\text{Rate} = \frac{\text{Total Actual Expenditure}}{\text{Total Funds Released}} \times 100\%$.
   - Flags: Low Utilization ($< 30\%$ High, $< 50\%$ Medium), Over-Utilization ($> 110\%$).
   - Per-state normalized z-scores & Year-over-Year utilization drops $> 40$ percentage points.

---

## 🚀 Quickstart & Deployment

### Option A: Docker Compose (Production Deployment)

```bash
# 1. Clone repository
git clone <repo-url>
cd SIH102

# 2. Start all services (Database, Redis, Backend, Frontend)
docker-compose up -d --build

# 3. Access Web Applications
# Frontend UI:  http://localhost
# Backend API:  http://localhost:8000/docs
```

### Option B: Local Development Setup

#### Backend:
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Unix: source venv/bin/activate
pip install -r requirements.txt

# Run migrations & launch dev server
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

---

## 🧪 Testing & Validation

### Run Full Pytest Suite (with Coverage)
```bash
cd backend
pytest tests/ --cov=app --cov-report=term-missing
```
*Current test suite: **54/54 tests passing (100% green)** with **88% code coverage**.*

### Run Ground-Truth Anomaly Detection Benchmark
```bash
cd backend
python scripts/validate_detection.py --constituencies 50 --works-per-constituency 100
```
*Evaluates Precision, Recall, and F1 across all 5 detectors against injected anomalies.*
