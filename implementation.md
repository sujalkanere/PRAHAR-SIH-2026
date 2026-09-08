
# MPLADS Sentinel — Implementation Plan

> **Purpose:** This document is the implementation source-of-truth for Antigravity/Gemini. It translates the intended technical approach, the current repository, and the supplied live UI screenshots into a prioritized engineering plan covering **pending work, security/correctness fixes, replacements, optimization, UI improvements, and deliberate non-work**.
>
> **Execution style:** high-confidence parallel sprints with explicit integration gates. The repository is treated as the current truth for what already exists; the technical-approach diagram is treated as the target product architecture. Where they conflict, the conflict is called out rather than silently papered over.

---

## 1. Executive assessment

### Current state

The repo is a credible MVP rather than a blank project. It already has:

- React 18 + Vite frontend with React Router, Recharts and TanStack React Query.
- FastAPI + SQLAlchemy backend.
- Authentication, role/scope concepts, admin flows, analytics, reports, works and alerts.
- Deterministic rule/statistical anomaly detection and a 0–100 risk score.
- Synthetic-data/bootstrap support and test suites.
- A route structure that broadly matches the product shown in the supplied screenshots.

The repository documentation explicitly describes cost overrun, duplicate work, delay/stall, fund-utilization and suspicious-pattern detection, plus a composite risk score. It also documents a model-upgrade path, web-scraping work that is only partial, and a number of security/deployment items that are MVP-level rather than production-hardened.

### Biggest product gap

The target architecture shown in the technical-approach diagram has **six risk checks**:

1. Cost risk
2. Delay risk
3. Payment risk
4. Duplicate detection
5. Compliance risk
6. Durability / asset-quality risk

The current runtime detection layer is effectively centered on **five implemented dimensions**: cost overrun, delay, duplicate detection, fund utilization, and suspicious-pattern detection. Payment risk, compliance risk, and durability/asset-quality risk are therefore not merely polish tasks; they are core capability gaps that must be resolved or explicitly marked data-unavailable.

### Biggest architecture conflict

The diagram shows a **Claude API explanation layer**. The repository's own model/SRS documentation says external AI/ML API calls are prohibited and that the intended path is local/bundled, reproducible and explainable. The implementation should therefore keep the risk engine independent of any hosted LLM.

Recommended architecture:

```text
Data ingestion
   -> validation / normalization
   -> analytical facts
   -> deterministic + local statistical/ML detectors
   -> 6 risk signals
   -> explainable 0–100 score
   -> investigation queue

                         +------------------------------+
                         | Explanation adapter          |
                         | default: deterministic/local |
                         | optional: external LLM       |
                         +------------------------------+
                                      |
                              human-readable text
```

If a hosted Claude explanation is required for a hackathon demo and the organizers explicitly allow external AI calls, make it an **optional server-side adapter**, feature-flagged off by default, never the source of truth for the score, and never callable directly from the browser.

### Biggest engineering risks

The highest-risk issues are not visual:

- A role with a missing scope can fall through to effectively unrestricted access.
- Password salts are deterministically derived from the password instead of randomly generated.
- Access and refresh tokens are stored in `localStorage`, increasing XSS impact.
- Production configuration contains dangerous development defaults.
- Backend analytical endpoints do a lot of Python-side aggregation.
- Duplicate detection can become quadratic.
- Constituency detail does not consistently apply the selected financial year.
- Detection after upload runs synchronously, blocking the request.
- Monetary values are represented as floating-point values.
- Application startup bootstraps demo data unconditionally.

Those items should be addressed before cosmetic optimization.

---

# 2. Implementation priorities

| Priority | Meaning | Target |
|---|---|---|
| **P0** | Security, correctness, data integrity, production blockers | Must fix first |
| **P1** | Target-architecture capability gaps | Must implement next |
| **P2** | Performance, maintainability, UX architecture | Implement after core correctness |
| **P3** | Visual polish, delight, reporting quality | Implement once core behavior is stable |
| **P4** | Optional/demo enhancements | Only if time remains |
| **CUT** | Deliberately do not build now | Avoid scope creep |

---

# 3. P0 — Security and correctness blockers

## P0.1 Fix authorization fail-open behavior

### Current issue

The backend scope filter can return no filter when a scoped role has no `scope_value`. That is a fail-open design. A malformed or partially provisioned user must never receive broader access than intended.

### Required change

Change the authorization model to fail closed:

```python
if role_requires_scope and not user.scope_value:
    raise HTTPException(status_code=403, detail="User scope is not configured")
```

Apply this consistently to:

- query builders
- object-level access checks
- constituency detail
- work detail
- analytics
- report generation
- exports
- admin actions

### Acceptance criteria

- State-scoped user without scope cannot access anything.
- Constituency-scoped user without scope cannot access anything.
- Cross-scope URL tampering returns 403, never 200.
- Tests cover missing scope, wrong scope, and nested object access.

### Files to modify

- `backend/app/security.py`
- `backend/app/queries.py`
- `backend/app/routers/*.py`
- security/auth tests

---

## P0.2 Replace deterministic password salts

### Current issue

The password hashing implementation derives its salt deterministically from the password. This defeats an essential property of password salts: the same password should not result in the same stored digest across accounts.

### Required change

Use a vetted password hashing library with unique random salts and a modern password KDF. Preferred options:

- **Argon2id** if operationally acceptable.
- bcrypt if dependency constraints make it materially easier.

Do not hand-roll the KDF or salt generation.

### Migration behavior

- New registrations use the new format.
- Existing hashes are recognized and upgraded on successful login.
- After successful upgrade, replace the old hash in a single transaction.
- Never log plaintext or intermediate hashes.

### Acceptance criteria

- Two accounts with the same password have different stored hashes.
- Password verification remains backward-compatible during migration.
- Old weak hashes disappear over time.

### Files

- `backend/app/security.py`
- `backend/app/routers/auth.py`
- user migration tests

---

## P0.3 Harden JWT/session handling

### Current issues

The current auth flow stores access and refresh tokens in browser storage and does not revoke/rotate refresh tokens on logout.

### Required design

Prefer:

- short-lived access token
- refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie
- refresh-token rotation
- token-family/reuse detection
- server-side revocation state for refresh tokens
- logout invalidates the active refresh token/family

If browser-storage tokens are retained temporarily for hackathon simplicity, explicitly label this as a temporary compromise and do not present it as production-ready.

### Additional hardening

- Add issuer/audience claims.
- Add token ID (`jti`).
- Add key versioning.
- Move from HS256 to an asymmetric signing key such as RS256 or EdDSA when operationally feasible.
- Validate expiry on every token operation.
- Add replay detection for rotated refresh tokens.

---

## P0.4 Remove dangerous production defaults

Current config contains development-oriented defaults such as a development JWT secret, permissive CORS, development environment and SQLite fallback.

Production startup should **fail fast** when required secrets or settings are missing.

Implement:

- `ENVIRONMENT=production`
- required JWT signing key configuration
- explicit frontend origin allow-list
- explicit database URL
- explicit demo-data flag
- explicit external-explanation flag
- secure cookie flags
- trusted proxy configuration if deployed behind a proxy

Never silently convert a production deployment into a demo deployment.

---

## P0.5 Stop automatic demo seeding on every startup

The FastAPI startup path currently bootstraps with demo data. That is acceptable for a local demo, not for a deployment containing real data.

Split behavior:

```text
DEV_DEMO=true   -> bootstrap demo data if database is empty
DEV_DEMO=false  -> only migrate / verify schema
```

Use Alembic migrations as the schema lifecycle mechanism.

---

## P0.6 Fix financial-year consistency

The constituency detail flow does not consistently apply the selected financial year to the work-level data used for components/timeline/duplicate context.

### Required behavior

Every analytical query must carry the same filter context:

```text
state
constituency
financial_year
status
risk tier
search/sort where applicable
```

A selected FY must affect:

- KPI values
- risk components
- work table
- trend series
- anomaly table
- duplicate context
- exports
- reports

### Test

Select FY 2024–25 and verify that no work from 2023–24 can affect a KPI or chart on that page.

---

## P0.7 Make ingestion validation row-safe

Coordinate parsing currently has a path where malformed latitude/longitude can escape row-level validation and produce request-level failures.

Implement:

- typed parsing
- latitude range validation `[-90, 90]`
- longitude range validation `[-180, 180]`
- row-level error accumulation
- maximum error count to prevent giant error payloads
- duplicate `work_id` policy in the same input file
- explicit overwrite/upsert semantics
- deterministic import ID / checksum for idempotency

Return a structured ingestion report:

```json
{
  "received": 10000,
  "accepted": 9931,
  "rejected": 69,
  "duplicate_rows": 11,
  "warnings": 8,
  "import_id": "..."
}
```

---

## P0.8 Replace floating-point money fields

Use `Numeric(18,2)` / `Decimal` for sanctioned amounts, expenditures and payment amounts.

This is especially important because the product is an audit/risk system and amounts are surfaced in reports and explanations.

Add database constraints for:

- non-negative financial amounts
- valid percentages
- valid risk score range 0–100
- valid severity/status enums
- valid FY format

---

# 4. P1 — Complete the target architecture

## P1.1 Implement the missing sixth-risk-check model correctly

The ideal architecture says six checks. The runtime must expose six coherent categories even when some source data is unavailable.

### Target component model

```text
cost_risk
 delay_risk
 payment_risk
 duplicate_risk
 compliance_risk
 durability_risk
```

Keep `pattern_anomaly` and `fund_utilization` as supporting signals or sub-signals rather than allowing them to replace the target categories.

### Recommended score structure

```text
component_score = 0..100
confidence = 0..100
status = OK | WATCH | HIGH | CRITICAL
reasons[]
provenance[]
```

Then compute the composite score through an explicit weighting configuration.

Example default only (validate against the SRS):

```text
Cost              20%
Delay             15%
Payment           15%
Duplicate         20%
Compliance        15%
Durability        15%
```

Do not hard-code these weights across multiple files. Put them in a versioned scoring configuration.

### Important rule

Do **not** invent evidence for missing inputs. If payment or inspection data is not present:

```text
status = DATA_UNAVAILABLE
confidence = 0
score contribution = neutral / excluded according to scoring policy
reason = "Required source evidence is unavailable"
```

This is more credible than generating fabricated risk.

---

## P1.2 Payment Risk

Build a detector around real payment evidence once available.

Potential signals:

- unusual payment-to-progress ratio
- repeated payments at suspicious intervals
- large final payment with low reported completion
- vendor/account concentration
- sanctioned vs released vs paid mismatch
- sudden payment spikes
- payment before work milestones

Each rule should produce:

```text
rule_id
severity
confidence
value
threshold
reason
source_field(s)
```

---

## P1.3 Compliance Risk

Create a separate, explainable rules module.

Candidate signals:

- missing mandatory fields/documents
- impossible/inconsistent dates
- work completed before sanctioned date
- incomplete inspection evidence
- invalid administrative mapping
- repeated exception patterns
- sanction/agency mismatches

Keep compliance independent of financial-risk logic so investigators can tell **why** a project failed compliance.

---

## P1.4 Durability / asset-quality risk

Use inspection/evidence fields when present.

Candidate signals:

- repeated adverse inspection findings
- quality observations near completion
- early post-completion defects
- repeated repair / maintenance events
- unusually low expected durability compared with project class

When real inspection evidence is not available, do not fake it. Implement the schema + placeholder detector state and mark it as awaiting evidence.

---

## P1.5 Upgrade duplicate detection

### Current problem

Pairwise Jaccard comparison is simple and explainable but becomes expensive at scale.

### Recommended replacement

Use a two-stage candidate generation pipeline:

```text
1. Blocking
   - constituency
   - work category
   - approximate amount band
   - time window

2. Cheap similarity
   - TF-IDF cosine similarity

3. Optional semantic similarity
   - local sentence-transformer embeddings
   - pgvector or FAISS

4. Exact pair scoring
   - amount similarity
   - date gap
   - location/category consistency

5. Store only candidate pairs above threshold
```

Keep Jaccard as an explanatory feature/fallback, not the only detector.

Do not add a large vector stack until the benchmark shows it is needed; the first safe replacement is TF-IDF + candidate blocking.

---

## P1.6 Add the LLM explanation layer safely

### Recommended default

Use a deterministic explanation generator first. It should turn structured evidence into a polished explanation without changing the score.

Input contract:

```json
{
  "score": 87,
  "signals": [
    {
      "name": "cost_risk",
      "severity": "HIGH",
      "value": 1.62,
      "threshold": 1.20,
      "confidence": 0.98,
      "reason": "Actual expenditure exceeded the peer-adjusted threshold"
    }
  ]
}
```

Output contract:

```json
{
  "summary": "Project flagged due to significant cost escalation and delayed progress.",
  "key_reasons": [],
  "evidence": [],
  "limitations": []
}
```

### Optional hosted-Claude adapter

Only implement when policy permits it.

Architecture:

```text
Frontend
   -> FastAPI /explanations/{project_id}
      -> explanation service
         -> policy/redaction layer
         -> prompt template
         -> provider adapter
         -> response validator
         -> audit log
```

Controls:

- API key only on server
- never expose provider credentials to React
- strict request/response schema
- PII minimization/redaction
- timeout
- retry only where safe
- circuit breaker
- per-user/project rate limit
- response length cap
- prompt version stored in audit metadata
- deterministic fallback if provider unavailable
- feature flag default OFF if external AI is disallowed

The score must always come from the deterministic/local analytical engine.

---

## P1.7 Implement real India geographic visualization

The target screenshot is visually closer to a real choropleth map than the current accessible state-grid approach.

Recommended implementation:

- GeoJSON boundary dataset
- Leaflet or MapLibre-based rendering
- state-level fill by composite risk
- hover tooltip
- click-to-state navigation
- legend with accessible labels
- no dependency on external tile provider for the basic map surface if unnecessary

Use lazy loading because maps are heavier than simple charts.

Do not switch the entire visualization stack to Plotly merely to obtain a map. Add the minimum mapping technology needed.

---

# 5. P1/P2 — Backend architecture and performance

## P2.1 Move analytics from Python aggregation toward SQL aggregation

Current analytics code loads analytical rows and aggregates many values in Python. This works at MVP scale but becomes inefficient as data grows.

Move high-level aggregations into SQL:

- state totals
- national totals
- active anomaly counts
- severity distributions
- category counts
- trend series
- top-risk constituencies

Use SQL `GROUP BY`, conditional aggregation and scoped subqueries.

For repeated heavy dashboards, introduce materialized analytical tables/views:

```text
national_year_summary
state_year_summary
constituency_year_summary
anomaly_year_summary
```

Refresh after ingestion/detection or asynchronously.

---

## P2.2 Add database indexes based on query patterns

Expected indexes:

- `(financial_year, constituency_id)`
- `(financial_year, state)` where applicable
- `(risk_score DESC)` where useful
- anomaly `(status, severity, created_at)`
- anomaly `(financial_year, constituency_id)`
- work `(work_id)`
- work `(constituency_id, financial_year)`
- normalized text search support if adopted

Use `EXPLAIN ANALYZE` on real dashboard queries before and after indexing.

Do not create every imaginable index; monitor write overhead.

---

## P2.3 Replace N+1 upload operations with bulk upserts

Current ingestion repeatedly looks up/upserts constituency records and can load large portions of the table into memory.

Replace with:

```text
normalize rows
-> resolve unique constituency keys once
-> bulk insert/update reference entities
-> bulk upsert works
-> bulk replace/upsert analytical facts
```

Use SQLAlchemy bulk operations or SQL primitives appropriate to PostgreSQL.

---

## P2.4 Make detection an asynchronous job

Current upload triggers detection synchronously.

Recommended flow:

```text
POST /admin/import
    -> persist import record
    -> enqueue detection job
    -> return import_id / job_id

GET /jobs/{job_id}
    -> queued | running | succeeded | failed
```

For the hackathon, Redis + Celery/RQ is acceptable if detection really blocks. Do not create a microservice for each detector.

Alternative for a very small demo: a single in-process worker is acceptable, but the API must still return immediately and expose progress/state.

---

## P2.5 Add robust observability

Implement:

- structured JSON logging
- correlation/request ID
- job ID for ingestion/detection
- duration metrics
- detector runtime metrics
- import row counters
- error counters
- health endpoint
- readiness endpoint

At minimum expose:

```text
GET /health/live
GET /health/ready
```

---

## P2.6 Add API response contracts

The backend should have explicit schemas for every dashboard payload rather than loosely structured dictionaries where possible.

Prefer versioned domain contracts:

```text
NationalSummary
RiskTrendPoint
RiskComponent
AnomalyRow
WorkSummary
InvestigationAction
```

Add generated OpenAPI validation as part of CI.

---

## P2.7 Fix pagination/search behavior

Backend pagination should validate:

- page >= 1
- per_page within hard maximum
- sort field against allow-list
- direction against allow-list

Search should be useful across:

- work ID
- description
- agency
- constituency
- category

Do not interpolate arbitrary sort columns.

---

# 6. P1/P2 — Data ingestion and provenance

## P1.8 Implement source ingestion/provenance

The ideal architecture begins with MPLADS data collection. The repository's documentation treats web scraping as partial.

Build a source adapter abstraction:

```text
SourceAdapter
  fetch()
  parse()
  normalize()
  validate()
  provenance()
```

Store:

- source URL / source identifier
- fetched timestamp
- dataset period
- content checksum
- importer version
- schema version
- import ID
- raw-file reference where allowed

### Scraping rules

Only scrape data from approved/public sources and respect site policies. Build a manual CSV upload fallback so the dashboard remains functional when a source is unavailable.

Never make the whole product dependent on one scraper.

---

# 7. Frontend — visual redesign and light theme

## Target visual direction

The screenshots show a strong dark “intelligence dashboard” aesthetic. The user requirement is now to integrate a **light theme across the product**. The redesign should therefore not simply invert the current colors; it should create a deliberate light-government-analytics visual system.

### Recommended visual language

- warm/light neutral page background
- white primary surfaces
- deep navy text
- blue primary action color
- green for healthy/safe
- amber for watch/moderate
- orange/red for high/critical
- subtle borders instead of heavy shadows
- 12–16px card radii
- restrained gradients only for hero/summary surfaces
- consistent iconography
- compact typography with strong numerical hierarchy

### Avoid

- excessive glow
- neon gradients on every card
- emoji as UI icons
- mixed icon styles
- dark fixed navigation when the rest of the application is light
- large blank chart areas
- overly rounded “consumer SaaS” shapes that reduce the government/audit-tool feel

---

## P2.8 Build a real design-token system

Create CSS variables for:

```text
--color-bg
--color-surface
--color-surface-elevated
--color-border
--color-text
--color-text-muted
--color-primary
--color-success
--color-warning
--color-danger
--color-info
--radius-sm/md/lg
--shadow-sm/md
--space-1..12
--font-size-*
```

All component colors must reference tokens.

Remove arbitrary per-component hex colors and inline color overrides in pages.

### Theme requirement

Make light theme the default everywhere:

- login
- public view
- national overview
- state dashboard
- constituency detail
- work explorer
- alert queue
- reports
- admin
- loading/error/empty states
- modals/drawers
- charts
- tables
- tooltips

If a dark theme is retained, make it an explicit optional theme later. It must never create a second visual design system.

---

## P2.9 Replace text/emoji icons with a consistent icon library

The current navigation/UI uses text glyphs/emoji-style symbols in several places.

Add a small, consistent icon library such as Lucide React.

Use icons by semantic meaning:

```text
Dashboard
Map
Alert
FileText
Shield
Search
Download
Settings
Users
Chevron
ExternalLink
```

Do not use icons as decoration when they do not add meaning.

---

## P2.10 Refactor the application shell

The current `App.jsx` is doing too much routing, shell/navigation and page metadata work.

Refactor toward:

```text
src/
  app/
    AppRouter.jsx
    routeConfig.js
    AppShell.jsx
    navigation.js
  components/
    layout/
    data-display/
    charts/
    feedback/
    forms/
  pages/
  lib/
```

Add:

- route-level lazy loading
- Error Boundary
- global toast/notification system
- modal/drawer primitives
- breadcrumb component
- page header component
- global filter bar component

Do **not** migrate the entire project to TypeScript unless the implementation team finds a concrete reason. That is not a required refactor for this phase.

---

# 8. Dashboard UI improvements

## 8.1 National overview

Replace a static KPI grid with a richer executive view:

### KPI cards

Each card should contain:

```text
label
primary value
period / scope
trend or delta
small explanatory caption
```

Examples:

- Total sanctioned works
- Total expenditure
- High-risk constituencies
- Active anomalies

Add click-through behavior for every meaningful KPI.

### Above-the-fold hierarchy

Recommended order:

```text
Page title + FY + filters
KPI row
Map + Top-risk table/chart
Risk trend + category mix
Priority alerts
```

---

## 8.2 India risk map

Implement a true choropleth.

Interaction:

- hover state
- selected state
- keyboard focus where feasible
- tooltip with score, anomaly count, expenditure
- click opens state dashboard

Do not use color as the only information channel. Include numeric labels or accessible tooltip text.

---

## 8.3 Top-risk constituencies

Improve the bar chart:

- fixed max row count
- risk score labels
- severity marker
- click target on row/bar
- clear “show all” action
- consistent scale

Prefer a compact ranked table for accessibility if the chart becomes redundant.

---

## 8.4 Anomaly category donut

The current donut is visually attractive but should communicate more information.

Add:

- center total
- hover percentage
- count
- legend aligned to the category names used by the detector
- empty state when no anomalies exist

Ensure the category names and colors are centralized.

---

## 8.5 Fix the anomaly trend chart

The supplied screenshot shows a large chart area with little/no visible series.

This must be treated as a correctness/UX issue, not merely a styling issue.

Checklist:

- verify API returns non-empty points
- include selected FY context where appropriate
- render a proper no-data state if empty
- show axis labels
- show tooltip
- show series visibility state
- avoid a misleading empty plot frame

---

# 9. Alert / investigation UX

The ideal workflow ends with authority verification and investigation. Make that visually obvious.

## Alert list

Use columns:

```text
Severity
Project / Work
Constituency
Risk score
Detection
Confidence
Age
Status
Action
```

## Investigation drawer

Clicking an alert should open a right-side evidence drawer with:

- risk score
- component contribution bars
- top reasons
- raw values vs thresholds
- source/provenance
- timeline
- duplicate matches if applicable
- notes
- status transition
- reviewer/action history

This is the most important UX enhancement for the “human-in-the-loop” story.

---

# 10. Explainable risk UI

Create a reusable `RiskExplanationPanel` component.

### Structure

```text
Risk score: 87 / 100
High risk

Why flagged?
────────────────────────
Cost risk       ██████████ 90
Delay risk      █████████  82
Payment risk    ██████     58
Duplicate       ██         18
Compliance      ███████    70
Durability      █████      50

Key evidence
• Cost is 60% above peer-adjusted threshold
• Project delay exceeds expected completion window
• Recent inspection shows poor asset condition

Source / confidence
Rule IDs / model version / input timestamp

Human-readable explanation
...
```

The UI should make it impossible to confuse an LLM-written explanation with the underlying evidence.

Label the source:

```text
Generated from analytical evidence
```

Optionally:

```text
Narrative generated by: Local model / Claude / Template
```

---

# 11. Tables, forms and interaction quality

## Tables

Add:

- sticky headers
- responsive horizontal scrolling
- sensible column widths
- compact/comfy density option if useful
- row hover
- keyboard focus
- empty state
- error state
- pagination summary
- server-side export of the current filter context

## Filters

Unify filter patterns across pages.

Recommended filter bar:

```text
Financial year
State
Constituency
Risk tier
Severity
Status
Search
```

Do not let every page invent a different filter component.

## Export

The current constituency CSV behavior is too page-centric. Export should represent the current query context, not merely the rows visible on page 1.

Recommended:

```text
Export current results
Export all filtered results
Export report
```

Large exports should become background jobs.

---

# 12. Frontend data-fetching optimization

The current React Query usage is functional but can be improved.

## Add explicit cache policy

Use `staleTime` for dashboard data rather than relying on default refetch behavior.

Suggested ranges:

```text
National summary: 30–60s
Trend series: 60s
Reference data: 5–30m
Work details: 30–60s
Alerts: 15–30s
```

Tune based on actual freshness requirements.

## Invalidate selectively

Do not invalidate every query globally after an alert mutation.

Instead invalidate:

```text
alerts list
alert detail
affected national/state/constituency summaries
```

## Cancel stale requests

Use AbortSignal through the API layer for search/filter changes.

## Memoize heavy visual transforms

Use `useMemo` for large chart datasets and avoid repeated nested `find()` operations when a lookup map can be created once.

---

# 13. Frontend performance / bundle strategy

Implement route-level code splitting.

Heavy modules such as:

- map library
- charts
- report preview

should not all be loaded on the initial page.

Use lazy imports in the router and show route-level skeletons.

Measure bundle size before and after the change.

---

# 14. Testing strategy

The repo already has backend and frontend tests. Keep them and add confidence rather than replacing them.

## P0 security tests

Add tests for:

- missing role scope -> 403
- wrong state/constituency -> 403
- object ID tampering -> 403/404 as appropriate
- refresh token replay
- logout revocation
- expired token
- invalid signature
- password hash uniqueness
- password migration
- brute-force throttling
- SQL injection payloads
- XSS payloads in stored/displayed fields

## Detector golden tests

Create a small fixed dataset with known outcomes.

Every detector should have:

```text
input
expected signal
expected severity
expected reason
expected score contribution
```

This prevents UI or model refactors from silently changing the analytical result.

## FY consistency tests

The same work set must produce the same scope across:

- national dashboard
- state dashboard
- constituency page
- alerts
- reports
- CSV export

## E2E tests

Add Playwright for critical flows:

```text
login
-> national dashboard
-> state
-> constituency
-> open high-risk work
-> inspect explanation
-> acknowledge / update alert
-> export report
```

Add role-specific E2E paths for admin / transport officer / student-type roles actually present in the product.

## Accessibility

Use axe or equivalent automated checks and manually verify:

- keyboard navigation
- focus visibility
- form labels
- dialog focus trap
- color contrast
- reduced motion
- chart/table alternatives

---

# 15. CI/CD and reproducibility

## Dependencies

Backend dependencies should be pinned/locked. Current broad version ranges are not reproducible enough for a serious deployment.

Use one of:

- `uv` with lockfile
- Poetry lock
- requirements lock generated from a controlled environment

Keep npm lockfile committed.

## Docker

Use:

- multi-stage frontend build
- slim Python runtime image
- non-root runtime user
- healthchecks
- environment-driven configuration

Separate:

```text
docker-compose.dev.yml
docker-compose.prod.yml
```

Only add complexity justified by the deployment target.

---

# 16. Reporting improvements

Reports are a core audit artifact, not just an export button.

Improve report content:

```text
Cover / report metadata
Executive summary
Risk score
Risk component breakdown
Top evidence
Affected work list
Detection methodology
Data provenance
Investigation status
Limitations / missing data
Generated timestamp
```

Include page numbers and a consistent visual identity.

For large reports, generate asynchronously and expose a job status.

Never present generated narrative as factual evidence without showing the underlying data.

---

# 17. Architecture choices: keep vs replace

## KEEP

### React + Vite

Good fit for this dashboard. No reason to rewrite it.

### FastAPI

Good fit for the API, validation and analytical orchestration.

### SQLAlchemy

Keep it. Improve query design, transaction boundaries and database-specific capabilities.

### Recharts

Keep for ordinary dashboard charts. It is already integrated and good enough for bars, lines, area, donut and KPI visualization.

### React Query

Keep. Improve cache policy and invalidation.

---

## REPLACE / UPGRADE

### SQLite -> PostgreSQL

Use PostgreSQL for the real deployment target. It aligns better with concurrency, indexing, analytics and the intended pgvector path.

### Float money -> Decimal/Numeric

Mandatory for financial correctness.

### Deterministic password hash -> Argon2id/bcrypt

Mandatory security fix.

### Browser localStorage refresh token -> HttpOnly refresh cookie

Strongly recommended security upgrade.

### Jaccard-only duplicate detector -> candidate blocking + TF-IDF, then optional local embeddings

Performance and quality improvement.

### State-grid visualization -> India GeoJSON choropleth

To match the target product story.

### Synchronous detection -> queued job

To avoid blocked admin requests.

### Python-side repeated analytics aggregation -> SQL aggregation/materialized summaries

To scale.

### Emoji/text glyph icons -> consistent icon library

For UI quality and accessibility.

---

# 18. Explicitly unnecessary / do not do

These are scope traps.

## CUT: Full rewrite to another frontend framework

Do not move to Next.js, Vue or Angular for this project.

## CUT: Full TypeScript migration

Not necessary for the required outcome. Introduce types/contracts incrementally if needed.

## CUT: Replace Recharts just because the diagram says Plotly/Chart.js

The diagram is an architectural target, not a requirement to swap every library. Add a map library only where needed.

## CUT: MySQL support unless specifically required

Choose PostgreSQL as the primary production database. Supporting two relational databases adds complexity without helping the demo.

## CUT: Microservices

Keep one FastAPI application with modular domains.

## CUT: Hosted LLM inside every detector

The detector must remain deterministic/local and auditable.

## CUT: LLM-generated risk scores

Never let free-form narrative generation determine the analytical score.

## CUT: Kubernetes

Not needed for a hackathon / single deployment target.

## CUT: Giant design-system rewrite

Create a focused token/component layer and migrate existing pages progressively.

---

# 19. Recommended repository structure after refactor

```text
backend/
  app/
    core/
      config.py
      logging.py
      security.py
    db/
      database.py
      migrations/
    domain/
      works/
      anomalies/
      risk/
      investigations/
      reports/
    detectors/
      cost.py
      delay.py
      payment.py
      duplicate.py
      compliance.py
      durability.py
      patterns.py
      fund_utilization.py
    services/
      scoring.py
      explanations.py
      ingestion.py
      exports.py
    routers/
    schemas/
    models/
    jobs/

frontend/
  src/
    app/
    components/
      charts/
      data-display/
      feedback/
      investigation/
      layout/
      risk/
    pages/
    lib/
      api.js
      queryClient.js
      formatters.js
      permissions.js
    styles/
      tokens.css
      theme.css
      components.css
```

Do not perform this refactor as one huge move. Introduce the structure as files are touched.

---

# 20. High-confidence parallel sprint plan

## Sprint 0 — Baseline + safety gate

**Parallel tracks**

### Track A — security

- fail-closed scope
- password hashing upgrade
- token/session hardening
- secret/default validation

### Track B — data correctness

- FY filter consistency
- monetary numeric types
- ingestion validation
- pagination validation

### Track C — UI baseline

- screenshot current all routes
- tokenized light theme
- icon system
- shell refactor

### Track D — analytical architecture

- define six risk components
- define evidence schema
- define score contract
- build detector golden dataset

**Integration gate**

No P1 feature work proceeds until:

- all existing tests pass
- new P0 tests pass
- production config fails closed
- FY behavior is verified

---

## Sprint 1 — Complete the target capability

### Backend track

- payment detector
- compliance detector
- durability detector
- scoring configuration
- explanation schema

### Data track

- provenance model
- source adapter interface
- scraper/manual-ingest reconciliation

### Frontend track

- six-component risk visualization
- investigation drawer
- improved alert queue
- map prototype

### Platform track

- async detection job
- job status endpoint

**Integration gate**

One end-to-end project must travel from:

```text
ingestion -> detection -> score -> explanation -> alert -> investigation -> report
```

without manual database editing.

---

## Sprint 2 — Scale and polish

### Backend

- SQL aggregation
- query indexes
- bulk upserts
- selective invalidation

### Frontend

- full light-theme migration
- responsive drawer navigation
- chart corrections
- loading / empty / error consistency
- keyboard/accessibility pass

### Detection

- duplicate candidate blocking
- TF-IDF baseline benchmark
- optional local embeddings

**Integration gate**

Run the benchmark dataset at multiple sizes and record:

```text
10k works
25k works
50k works
```

Track:

- ingestion duration
- detection duration
- top dashboard API latency
- browser initial load

---

## Sprint 3 — Demo readiness

- report redesign
- E2E suite
- accessibility audit
- final data seeding
- screenshot review against target
- failure-state testing
- Docker production run
- security checklist
- README refresh

---

# 21. Definition of done

The implementation is complete when all of the following are true.

### Product

- six target risk categories are represented in the analytical model
- every risk result is explainable
- investigation flow is obvious in the UI
- the LLM, when present, only generates narrative
- source/provenance is visible

### UI

- light theme is coherent across every route
- charts have correct no-data states
- navigation and iconography are consistent
- national map is geographic rather than a placeholder grid
- alert details show evidence and reasons
- responsive layout works at desktop/tablet/mobile widths

### Security

- scoped users fail closed
- passwords use secure random-salt KDF
- refresh tokens are protected and revocable
- production secrets are required
- CORS is explicit
- demo seeding is disabled in production

### Data

- monetary values use decimal/numeric
- ingestion is row-safe and idempotent
- FY filters are consistent
- exports match filters
- provenance is stored

### Performance

- dashboard aggregation is primarily DB-side
- duplicate detection is candidate-pruned
- detection is asynchronous for long jobs
- routes are code-split
- query caching/invalidation is deliberate

### Quality

- backend tests pass
- frontend tests pass
- E2E tests pass
- security regression tests pass
- accessibility checks pass
- production Docker build starts without demo defaults

---

# 22. Implementation order for Antigravity

Use this exact dependency order unless a verified code-level dependency forces a change:

```text
1. Read repo + this plan
2. Establish baseline tests/build
3. P0 security + correctness
4. Database/migration hardening
5. Six-risk domain contract
6. Detection gaps
7. Explanation contract
8. Async jobs
9. Backend query optimization
10. Light-theme design tokens
11. App shell refactor
12. National dashboard redesign
13. Investigation UX
14. Map
15. Reports/export
16. E2E + accessibility
17. Performance benchmark
18. Production verification
```

Never optimize a component that is about to be replaced. Never redesign a screen whose API/data contract is still unstable unless the change is intentionally visual-only.

---

# 23. Engineer's implementation rules

1. **Preserve working behavior unless the plan explicitly replaces it.**
2. **Do not fabricate missing source data.** Missing evidence must remain visible as missing evidence.
3. **Do not let UI state become the source of truth for authorization.** The backend is authoritative.
4. **Do not let an LLM change the risk score.**
5. **Do not put provider API keys in the frontend.**
6. **Prefer incremental refactors over a giant rewrite.**
7. **Every detector change gets a golden test.**
8. **Every authorization change gets a negative test.**
9. **Every page must support loading, empty and error states.**
10. **No arbitrary color constants inside page components after the theme pass.**
11. **No global query invalidation for a local mutation unless proven necessary.**
12. **No new dependency without a concrete problem statement.**

---

# 24. Final product target

The finished product should feel like a serious public-sector investigation console rather than a generic analytics dashboard:

```text
DATA
  -> TRUSTED / PROVENANCE-AWARE

ANALYSIS
  -> DETERMINISTIC + LOCAL ML

RISK
  -> 6 COMPONENTS + 0–100 SCORE

EXPLANATION
  -> EVIDENCE-FIRST NARRATIVE

INVESTIGATION
  -> HUMAN DECISION + AUDIT TRAIL

UI
  -> LIGHT, ACCESSIBLE, CALM, HIGH-DENSITY
```

The central UX idea is **“from signal to evidence to action.”** Every major number should answer three questions:

1. Why is this high/low?
2. What evidence caused it?
3. What can the authority do next?

That is the clearest way to make the technical architecture and the actual product reinforce each other.
