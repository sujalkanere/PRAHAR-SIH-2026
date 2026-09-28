# PRAHAR — Implementation Roadmap (Quarterly)
**Target:** Code-modification AI agent working on the existing PRAHAR / MPLADS Sentinel codebase
**Source of truth for current state:** `Project-Report.md` (system architecture as-built) plus a live screenshot audit of the deployed product (national dashboard, admin console, role-scoped views, work-level dossier)
**Purpose:** Close the gap between the current implementation and the SIH problem statement's "Expected Solution," fix confirmed defects, and add the missing features identified across evaluator review — organized into four sequential quarters so scope stays bounded and verifiable at each checkpoint.

Do not remove or weaken any existing detection engine, RBAC rule, or security control described in `Project-Report.md`. This document is additive and corrective, not a rewrite.

---

## Before You Start — Verification Rules (read this before touching code)

These rules exist because part of this plan was written before the live product was audited, and one item (Q1.1) turned out to already be partially implemented differently than first assumed. To prevent repeating that mistake:

1. **Inspect current state before implementing anything marked "new."** Before creating any table, field, endpoint, or component this document calls "new," check whether it already exists under a different name. Where this document offers two possible implementation approaches, inspect the codebase first and pick based on what's already there — do not implement both, and do not guess.
2. **Treat every number in this document as provisional, not ground truth.** Rupee figures, MP counts, and work counts mentioned below are what was observed at audit time (see Q1.1). Always compute current totals from the live database at implementation time rather than hardcoding the figures written here.
3. **When a section says "verify," that is not optional context — it is a required step before the associated fix.** Do not skip straight to the fix.
4. **Mark every acceptance criterion pass/fail explicitly** (in a PR description or commit message) rather than assuming a criterion is satisfied because related code was touched.
5. **Widget budget per page:** no dashboard page in this system should carry more than 6 primary widgets/cards above the fold. Several items below (Q1.5, Q1.6, Q2.1, Q2.2, Q3.1) each propose adding a component to `StateDashboardPage` or similar — before adding a fifth or sixth widget to any single page, consolidate or demote lower-priority ones rather than stacking indefinitely. This rule exists because slide-level density problems were already flagged once in this project's PPT and should not be repeated in the product itself.

---

## Quarterly Roadmap Summary

| Quarter | Theme | Contains | Why this grouping |
|---|---|---|---|
| **Q1** | Foundation, Trust & Quick Wins | Verify/complete RS-LS fix, headline-number reconciliation, test-naming fix, 9 audited bug fixes, SC/ST compliance engine, fund aging tracker | Fixes everything a judge or auditor could catch by inspection alone, plus the two cheapest, highest-credibility new features (pure arithmetic on existing data, no new UI pattern). Nothing here depends on anything else in the plan. |
| **Q2** | Structural Gaps & Role Clarity | Inspection quota tracker, role-specific dashboard redesign | Both require new schema/page-composition work and both touch `StateDashboardPage` — sequencing them together avoids redesigning the same page twice. |
| **Q3** | Advanced Analytics | Predictive insights module, SHAP on Isolation Forest only | Both are explicitly lower-priority than compliance-rule features and both benefit from a stable Q1–Q2 pipeline: predictive insights reuses the aging tracker's time-series logic, and SHAP assumes Q1's new detection stages are already integrated. |
| **Q4** | Hardening, Documentation & Scope Closure | Full documentation pass, end-to-end regression against every acceptance criterion in Q1–Q3, Future Work scoping (not built) | Nothing new is introduced; this quarter exists to verify the previous three quarters actually hold together and to formally record what was deliberately left out. |

Quarter numbers are sequential phases, not calendar-fixed — map Q1–Q4 to actual calendar quarters based on when implementation work begins.

---

# QUARTER 1 — Foundation, Trust & Quick Wins

## Q1.1 — Verify and complete the Rajya Sabha / Lok Sabha scope fix
**Status at time of writing:** partially resolved. The live product's landing page and national dashboard now both show 245 Rajya Sabha MPs + 543 Lok Sabha MPs = 788 total, with allocation and expenditure figures correctly split and summing across both. This resolves the original contradiction (the product previously claimed 543-constituency coverage while only ingesting 231 Rajya Sabha records, and Rajya Sabha members represent states rather than constituencies). **Do not re-implement this from scratch** — the task now is verification and closing remaining gaps, not a rebuild.

**Required steps, in order:**
1. Inspect the current schema to determine how Rajya Sabha vs. Lok Sabha members are actually distinguished (a `member_type` field on an existing table, a separate table, or another mechanism). Use whatever already exists as the canonical structure for all remaining work in this item — do not introduce a second, parallel representation.
2. Confirm Rajya Sabha records are keyed by `state` (not a fabricated constituency) and Lok Sabha records are keyed by a real `constituency_id`, consistent with how the national dashboard and landing page are currently rendering the RS/LS split correctly.
3. Audit every remaining screen and export path (PDF report headers, the AI chatbot's grounding context, the Admin Console) for copy that still implies Lok-Sabha-only or Rajya-Sabha-only scope — the Admin Console was observed saying "543 Lok Sabha dataset synchronization," which undersells actual current coverage (both chambers) and should be corrected to describe both.
4. Confirm no page computes "total MPs" or "total constituencies" as a hardcoded number — every such figure must be a live count query.
5. If full per-work data depth for all 543 Lok Sabha constituencies is not yet at parity with the depth available for Rajya Sabha records, note this as a known limitation in Q4's documentation pass rather than treating the headline count alone as "done."

**Acceptance criteria:** every page and export that states scheme coverage derives that statement from a live query; no page implies single-chamber coverage; Rajya Sabha entries never render against a fabricated constituency on any map or table.

## Q1.2 — Reconcile headline numbers across all project artifacts
**Status at time of writing:** the live dashboard and landing page are now internally consistent with each other (₹3,363.8 Cr allocation, 788 MPs, 9,927 completed works all matched between the two screens checked). The remaining risk is **external artifacts produced before this reconciliation** — specifically, the SIH PPT deck, which at an earlier point stated ₹831.8 Cr / 542 MPs, figures that no longer match the live product.

**Required steps:**
1. Designate `current_data.json` (Section 5.1, described as the gold-standard file) as the single source of truth for every headline metric shown anywhere in the product.
2. Add `as_of_date` and `source_dataset_version` fields to the `GET /api/v1/analytics/official-metrics` response so any number shown anywhere (dashboard, PDF export, chatbot) is traceable to one specific generation of the dataset.
3. Cross-check the current SIH PPT deck and any other external presentation materials against the live `official-metrics` endpoint. Where they disagree, either regenerate the slide numbers from the live endpoint or, if the deck cannot be edited immediately, note the discrepancy explicitly rather than presenting both documents to the same evaluator unreconciled.

**Acceptance criteria:** no two artifacts (PPT, README, live dashboard, PDF export) show different totals for the same metric at the same point in time; every displayed number can be traced to `source_dataset_version`.

## Q1.3 — Fix the test-naming overclaim
**Problem:** `test_detector_golden.py` is documented as verifying "zero false negatives on verified historical audit anomalies," which implies real, externally-confirmed fraud cases. The actual data source is the synthetic generator.

**Required steps:**
1. Rename the test's docstring/description to: "zero false negatives on known synthetic-injected anomalies (golden set)."
2. Add a code comment at the top of `test_detector_golden.py` clarifying the golden set is generated via `synthetic_generator.py`'s parametric anomaly injection, not sourced from real historical audits.
3. Search `Project-Report.md` and any other documentation for the same phrasing ("verified historical audit anomalies" or equivalent) and correct every instance found, not just the one already identified.

**Acceptance criteria:** no documentation or test description anywhere in the repository implies real-world audit validation that hasn't actually occurred.

## Q1.4 — Data integrity & demo-readiness bug fixes (from live screenshot audit)
Each item below was directly observed in a live screenshot, not inferred. Verify each is still present before fixing (per the Verification Rules above) in case any have already been addressed since the audit.

1. **"Works Recommended" total doesn't sum.** Landing page header showed 25,172; the Rajya Sabha (6,412) + Lok Sabha (18,732) breakdown beneath it summed to 25,144 — a 28-unit discrepancy. Every other headline stat on that page summed correctly. Find and fix the source (likely a stale cached total competing with a live breakdown query, or a dedup/rounding difference between the two queries backing the header vs. the split).
2. **Duplicate-detection flagship example failed a sanity read.** A showcased 100%-duplicate pair in the Pune constituency dossier had both work descriptions reading "...Duddi, Dis. Kupwada, Jammu & Kashmir..." while filed under a Maharashtra/Pune constituency. Audit `synthetic_generator.py` for cases where generated work-description text embeds location text inconsistent with the record's assigned `constituency_id`/`state`, and fix the generator so description text and assigned geography always agree. Treat this as the highest-priority item in this list — it is the single most likely example to be read closely in a live demo.
3. **Suspiciously repeated per-work values.** Multiple distinct works in the same constituency's list showed identical `actual_expenditure` (to the paisa) and identical `risk_score`, across different `work_category` values. Audit `synthetic_generator.py` for insufficient independent variance in generated expenditure values — likely a template/default value not being randomized per row.
4. **6-Dimension Risk Radar rendered as visually collapsed except one axis** for at least one CRITICAL-tier work observed. Confirm all six `risk_components` values are being passed to and rendered by the radar chart component, not only the dominant (max) dimension.
5. **Landing page marketed detection capabilities not visibly present in the live dashboard.** Specifically, a "Ghost Vendor & Shell Network Detector" (GSTIN/MCA21 cross-matching) and a "Treasury Single Account (TSA) Idle Fund Rebalancer," both with specific numeric claims (e.g., "47 High-Risk Entities," "18 Shell Clusters," "215 Twin GPS Pairs"), while the live dashboard's "Anomaly Distribution by Detection Category" still labeled itself as covering only 8 statutory engines with no visible matching category. **Resolve this with exactly one of the following two outcomes, not a partial mix:** (a) if these detectors are genuinely implemented in the backend but simply not surfaced in the dashboard's anomaly-category breakdown, surface them there with real counts; or (b) if they are not genuinely implemented, remove the specific numeric claims from the landing page and either drop the feature description or explicitly label it as planned/future work. If outcome (b) is chosen, the underlying concept belongs in the Future Work section at the end of this document, not on the public landing page with numbers attached.
6. **`trigger_type` column rendered blank** in the Detection Pipeline Execution History table (Admin Console) despite being a populated schema field (`MANUAL` / `AUTO_POST_UPLOAD` per Section 11). Fix the display binding.
7. **Verify `ROLE_MP` cannot browse outside its own constituency via the "State Explorer" nav link** observed in the MP sidebar. Per the existing RBAC matrix (Section 8.1), `ROLE_MP` is scoped to Constituency Level only. Confirm server-side that any endpoint reachable from that link enforces this scope — a client-side-only restriction (hiding the link but not restricting the API) is a real access-control gap, not just a cosmetic issue, and must be tested as such (attempt the underlying API call directly as a `ROLE_MP` user and confirm it is rejected for out-of-scope data).
8. **Reconcile product tagline copy.** The login page read "Automated Audit & Anomaly Detection for MPLADS Projects"; the landing page read "Autonomous Integrity Monitoring for MPLADS." Choose one and apply it everywhere the product name appears with a tagline.
9. **Stop hardcoding dataset totals into UI copy** — e.g., an Admin Console button labeled "Load Official Datasets (₹3,363.8 Cr)." Compute any such figure from live dataset metadata at render time so it cannot silently drift out of sync, the same way the Works Recommended total did in item 1.

**Acceptance criteria for Q1.4:** each of the 9 items above is independently verified fixed (not assumed fixed because related code was touched) and documented as such.

## Q1.5 — New feature: SC/ST Allocation Compliance Engine
**Why:** MPLADS guidelines mandate that each MP allocate at least 15% of their fund to Scheduled Caste–majority areas and at least 7.5% to Scheduled Tribe–majority areas. This is a literal, citable scheme rule, currently unrepresented anywhere in the schema or pipeline.

**Schema changes:**
- Add to the `works` table: `beneficiary_category` (`String(20)`, values `SC`, `ST`, `GENERAL`, `NA`), nullable, default `NA` for legacy rows.
- Add to whichever table now canonically stores per-MP/constituency records (confirmed per Q1.1, step 1): `sc_allocation_target_pct` (`Numeric(5,2)`, default `15.00`) and `st_allocation_target_pct` (`Numeric(5,2)`, default `7.50`) — configurable per future guideline revisions, not hardcoded in application logic.

**New detector — `sc_st_compliance.py`:**
```
For each MP / financial year:
  SC% = SUM(sanctioned_amount WHERE beneficiary_category = 'SC') / total_entitlement * 100
  ST% = SUM(sanctioned_amount WHERE beneficiary_category = 'ST') / total_entitlement * 100

  IF SC% < sc_allocation_target_pct:
      status = 'VIOLATION' if SC% < (target * 0.7) else 'AT_RISK'
  IF ST% < st_allocation_target_pct:
      status = 'VIOLATION' if ST% < (target * 0.7) else 'AT_RISK'
```
- Write results to a new `sc_st_compliance` table: `id`, `constituency_id` (or the equivalent member-record foreign key confirmed in Q1.1), `financial_year`, `sc_pct_actual`, `sc_pct_target`, `st_pct_actual`, `st_pct_target`, `status`, `calculated_at`.
- Wire into the existing pipeline orchestrator (Section 2) as an additional detection stage running after `fund_utilization.py`.

**New API:**
- `GET /api/v1/compliance/sc-st`: paginated, filterable by state/district/financial_year/status.
- Extend `GET /api/v1/constituencies/{id}` to include the latest SC/ST compliance record.

**New frontend:**
- `SCSTComplianceCard.tsx` on `ConstituencyDetailPage` and `StateDashboardPage` (respect the widget-budget rule when adding to `StateDashboardPage`): two progress bars (SC% vs. 15% target, ST% vs. 7.5% target), red/amber/green.
- Add an "SC/ST Compliance" column to the existing constituency table view using the same three-color badge system as `RiskBadge.tsx`.

**Acceptance criteria:** for any MP/financial year in the seeded dataset, SC% and ST% are computed from actual tagged `works` rows and match a manual spot-check calculation.

## Q1.6 — New feature: Unspent Fund / Aging Tracker
**Why:** the problem statement's title explicitly includes "inefficiencies." The system currently has no dedicated signal for money sanctioned/released but sitting unspent for an extended period — distinct from `fund_utilization.py`'s rate thresholds, which measure percentage, not time.

**Schema changes:** none required — computable from existing `fund_releases` and `expenditures` tables. Add derived fields to `constituency_risk_scores`: `avg_days_unspent` (Integer, Nullable), `max_project_days_unspent` (Integer, Nullable).

**New detector — `fund_aging.py`:**
```
For each work with status IN ('SANCTIONED', 'IN_PROGRESS'):
  days_idle = reference_date - sanction_date  (if actual_expenditure == 0)
             OR reference_date - date_of_last_expenditure  (if partially spent but stalled)

  IF days_idle > 180: AGING_MEDIUM
  IF days_idle > 365: AGING_HIGH
  IF days_idle > 730: AGING_CRITICAL

For each constituency / financial year:
  total_unspent_balance = SUM(cumulative_release - actual_expenditure) across works
```
- Emit as an additional detection stage, kept as a distinct `aging_risk` component in `risk_components` JSON — explicitly separate from `fund_utilization_risk`, not merged into it.
- Write anomalies to the existing `anomalies` table with `anomaly_type = 'FUND_AGING'`, reusing the existing severity/status/detected_at pattern — no new anomalies table needed.

**New API:**
- Extend `GET /api/v1/analytics/state-summary/{state}` and `district-summary/{district}` to include `total_unspent_balance` and `oldest_unspent_project_days`.
- `GET /api/v1/analytics/aging`: nationally ranked list of constituencies/districts by largest unspent balance and longest-idle project.

**New frontend:**
- `FundAgingWidget.tsx`: a worst-first horizontal bar chart on `NationalDashboardPage` and `StateDashboardPage` (respect the widget-budget rule), using the existing Recharts setup.

**Acceptance criteria:** a work with `actual_expenditure = 0` and `sanction_date` more than 365 days before the reference date is correctly flagged `AGING_HIGH`.

---

# QUARTER 2 — Structural Gaps & Role Clarity

## Q2.1 — New feature: Physical Inspection Quota Tracker
**Why:** the scheme guidelines require District Authorities to physically inspect at least 10% of works under implementation every year. No inspection data exists anywhere in the current schema — a genuine structural gap, not just a missing UI element.

**Schema changes — new table `inspections`:**
- `id` (UUID, PK)
- `work_id` (UUID, FK → `works.id`, Not Null)
- `district` (String(100), Not Null) — denormalized for fast aggregation
- `inspection_date` (Date, Not Null)
- `inspector_name` (String(255), Nullable)
- `inspection_outcome` (String(20): `SATISFACTORY`, `MINOR_ISSUES`, `MAJOR_ISSUES`, `ASSET_FAILURE`)
- `notes` (Text, Nullable)
- `photo_reference` (String(255), Nullable)
- `created_at` (DateTime)

**New detector — `inspection_coverage.py`:**
```
For each district / financial year:
  works_in_progress = COUNT(works WHERE district = X AND status IN ('SANCTIONED','IN_PROGRESS') AND financial_year = Y)
  works_inspected = COUNT(DISTINCT work_id FROM inspections WHERE district = X AND financial_year of inspection_date = Y)
  coverage_pct = works_inspected / works_in_progress * 100

  IF coverage_pct < 10.0: flag district as INSPECTION_QUOTA_VIOLATION (severity scaled by how far below 10%)
```
- Write to a new `inspection_coverage` table, structured consistently with `sc_st_compliance` (Q1.5).
- **Risk-score integration:** for any work in a district currently below the 10% quota, apply a capped upward adjustment (e.g., +5 points) to that work's `risk_score` via a new `oversight_risk` component in `risk_components` JSON. Document the exact formula and rationale in code comments — lower inspection coverage genuinely means less oversight, so this must be explainable as a defensible adjustment, not an arbitrary penalty, if a judge asks about it directly.

**New API:**
- `GET /api/v1/compliance/inspections`: district-level coverage table, sortable by lowest coverage first.
- `POST /api/v1/inspections`: allows District-role users to log a new inspection record (guarded server-side to `ROLE_DISTRICT`, `ROLE_ADMIN`).

**New frontend:**
- `InspectionCoverageTable.tsx` on `StateDashboardPage` — check the current widget count on this page (Q1.5's SC/ST card and Q1.6's aging widget may already be there) against the widget-budget rule before adding a fourth item; consolidate if needed.
- "Log Inspection" form (reuse `AddWorkModal.tsx` patterns) for District-role users.

**Acceptance criteria:** a district with 0 inspection records for a financial year with active works correctly shows 0% coverage and a quota violation; a district meeting the 10% quota shows no flag.

## Q2.2 — Role-specific dashboard redesign
**Finding from live screenshot audit:** the current role-based dashboards (Ministry, State, District, MP) are largely one widget template reused with a narrower data scope, rather than pages composed for what each role actually needs. This partially defeats the purpose of building role-based views: the problem statement names four distinct roles with distinct decision-support needs, not one dashboard shown four times with a filter. District Authority's page (a work-level investigation list) is the one existing exception and should be the model other roles are redesigned toward, not the outlier.

**Ministry (`ROLE_MINISTRY`) — no change required.** The full national choropleth, national top-10, trend chart, and anomaly-category breakdown are all genuinely appropriate at this scope. Treat this page as the base the others were copied from.

**State Nodal (`ROLE_STATE_NODAL`):**
1. Replace the full-India-outline choropleth (currently rendering all 36 states grayed out except the user's own) with a **zoomed map of the user's own state showing district-level risk coloring**. Requires district-level geographic boundaries in addition to the existing state-level `STATE_CENTROIDS` table (Section 5.2) — inspect first whether any district-boundary data source already exists in the codebase before adding a new `DISTRICT_CENTROIDS` table or GeoJSON asset.
2. Add a **district comparison table** — districts within the state ranked by risk score, fund utilization, and (once Q2.1 lands) inspection coverage. This does not currently exist and is the State Nodal role's actual operational task.
3. Keep the existing within-state top-10-constituencies chart and fund-flow trajectory — both are already correctly scoped.

**District Authority (`ROLE_DISTRICT`):** keep the existing investigation-list pattern unchanged. Separately, inspect whether District also has an overview-style landing page (distinct from the "District Works" investigation list) that duplicates the national template the way State and MP currently do — if so, apply the same fix described for MP below to that overview page specifically, not to the investigation list.

**Member of Parliament (`ROLE_MP`) — the most significant redesign:**
1. **Remove** the India-outline choropleth map entirely. A full-country map to represent one constituency communicates nothing and consumes the most valuable screen space on the page.
2. **Remove** the "Top-10 Highest Risk Constituencies" bar chart when scoped to a single constituency — with only one possible entry, a top-10 ranking is not a valid degenerate case of the component, it is a broken use of it.
3. **Add** a read-only "My Works" table, reusing the District Authority's work-list component but with investigation/triage actions stripped (no "Inspect Dossier," no status-change controls), consistent with `ROLE_MP` having no triage rights per the RBAC matrix (Section 8.1). This directly answers the PS's requirement that MPs see "project progress, utilization & risk visibility" for their own constituency — not currently visible as a discrete list anywhere in the MP view.
4. **Keep:** Fund Flow & Cumulative Trajectory, Work Execution Pipeline funnel, and the Anomaly Distribution donut — all three are genuinely about the MP's own constituency and remain useful at this scope.

**Implementation approach:**
- Keep underlying data-fetching and scoping logic shared, as it already is. Split **page composition** by role — introduce or modify distinct page components per role (`StateDashboardPage`, a District overview page if one exists, `MPDashboardPage`) that each assemble a different subset of existing widget components, rather than one national-style template conditionally hiding pieces.
- Confirm server-side scoping — not just which widgets are displayed — enforces every RBAC boundary in Section 8.1 for each redesigned page. A page must not expose an API call returning unscoped data even if the UI only renders part of the response.

**Acceptance criteria:** no role's dashboard contains a widget that cannot answer a real question for that role at that scope. A "Top 10" list with exactly one possible entry, or a national map used to represent a single data point, both fail this test and must be removed or replaced.

---

# QUARTER 3 — Advanced Analytics

## Q3.1 — New feature: Predictive Insights Module
**Why:** the problem statement explicitly asks for "predictive insights" twice. The system is currently entirely retrospective — it flags what already happened. This is the largest gap against the literal PS text. Keep this scoped to defensible, explainable forecasting; do not claim prediction sophistication beyond what is actually built.

**Scope — exactly two features, both statistical, not machine-learned, using data already in the schema:**
1. **Fund utilization pace forecast:** for each constituency/financial year, fit a linear trend on cumulative expenditure vs. days elapsed in the fiscal year (using `fund_releases`/`expenditures`), and project forward to fiscal year-end. If projected year-end utilization falls below the constituency's historical average or an absolute threshold (e.g., 60%), surface as a predictive alert: *"At current spending pace, Constituency X is projected to end the fiscal year at ~Y% utilization."*
2. **Delay-trajectory forecast:** for works currently `IN_PROGRESS`, compare elapsed time since `sanction_date` against the category's historical median time-to-completion (computed from `completed_works`, grouped by `work_category`). If elapsed time already exceeds the historical median with no recorded progress milestone, surface: *"This work has already exceeded the typical completion time for its category; historical pattern suggests elevated delay risk."*

**Implementation notes:**
- New module `predictive_insights.py`, using `numpy`/`pandas` (already in the stack — no new dependency).
- Every prediction response must include the method used (`method: "linear_trend_projection"` or `method: "category_median_comparison"`) and the data window it was computed on, so it is auditable, consistent with the existing XAI narrative pattern used for anomaly explanations.
- Label these explicitly as statistical projections in both the API response and the UI. Do not present them as machine-learned predictions with unstated confidence.

**New API:** `GET /api/v1/analytics/predictions`, filterable by state/district/constituency, returning both prediction types.

**New frontend:** `PredictiveInsightsPanel.tsx` on `NationalDashboardPage` and `ConstituencyDetailPage`, styled consistently with `InvestigationDrawer.tsx`'s plain-English narrative pattern.

**Acceptance criteria:** predictions are computed live from actual data, never hardcoded; every prediction response includes its method and data window.

## Q3.2 — Targeted SHAP explainability (Isolation Forest only — do not expand scope)
**Research finding, stated explicitly so this scope limit is not accidentally expanded later:** SHAP is valuable for explaining black-box models where the input-to-output relationship isn't analytically known. Most of PRAHAR's scoring — the composite risk formula (Section 7.1), the duplicate composite score (Section 6.3), and every rule-based detector — is a documented, hand-specified formula with known weights, already maximally explainable by construction. Running SHAP on top of these would approximate something already stated exactly, and would read as an unjustified addition to an evaluator who understands XAI. **Do not add SHAP to the composite risk score, the duplicate score, or any rule-based detector.**

The one genuine exception is the **Isolation Forest enrichment signal** inside `cost_overrun.py` (Section 6.1) — the system's only real black-box component. Today it appends `+ISOLATION_FOREST` to a detection signature with no per-feature breakdown, unlike every other signal in the system. SHAP on Isolation Forest is documented, established industry practice (not experimental), and is computationally cheap here given only 5 input features and on-demand (single-instance) rather than batch computation.

**Implementation:**
1. Add `shap` to backend dependencies.
2. In `cost_overrun.py`, after fitting the `IsolationForest` model, construct an explainer once at pipeline-run time using a representative background sample from the same training set already used to fit the model — no new data collection required:
   ```python
   import shap
   explainer = shap.Explainer(isolation_forest_model, background_sample)
   ```
3. Compute SHAP values **on-demand only**, for a single requested work — never in a batch pass over the full dataset.
4. Extend `GET /api/v1/works/{work_id}/explanation` (Section 9.2) to include a new `isolation_forest_attribution` field, populated only when the work's `risk_components` shows an active `+ISOLATION_FOREST` flag:
   ```json
   {
     "isolation_forest_attribution": {
       "top_contributing_features": [
         {"feature": "cost_per_day", "contribution": 0.34, "direction": "increases_anomaly"},
         {"feature": "duration_days", "contribution": 0.21, "direction": "increases_anomaly"},
         {"feature": "overrun_pct", "contribution": 0.05, "direction": "negligible"}
       ],
       "method": "shap_kernel_explainer",
       "computed_on_demand": true
     }
   }
   ```
5. Feed this attribution into the existing plain-language explanation generator as additional grounding context (e.g., "flagged primarily due to unusually high cost-per-day and short duration relative to peer projects"), matching the existing style rather than introducing a separate SHAP-specific UI paradigm.
6. Label this clearly everywhere it appears as applying **only to the Isolation Forest signal** — never presented as an explanation of the overall composite risk score.

**Frontend:** extend `InvestigationDrawer.tsx`'s existing 6-risk radar breakdown with a small expandable "Why did the ML model flag this?" sub-panel, shown only when `isolation_forest_attribution` is present.

**Acceptance criteria:** SHAP attribution is computed only for the Isolation Forest signal, only on-demand for a single requested work, and is never presented as an explanation of the composite risk score or any rule-based detector.

**Explicitly out of scope for this item:** SHAP on the composite risk formula, SHAP on the duplicate composite score, SHAP on any rule-based detector, batch SHAP computation across the full dataset.

---

# QUARTER 4 — Hardening, Documentation & Scope Closure

No new features are introduced in this quarter. Its purpose is to confirm the previous three quarters actually hold together, and to record — explicitly, so nothing discussed across this project's review is silently lost — what was deliberately left out.

## Q4.1 — Documentation & presentation consistency
1. Update `Project-Report.md` Section 1.1 to add "Inefficient Fund Utilization" as a named core problem (covering the Q1.6 aging signal), and correct Section 1's description of current MP/constituency coverage per Q1.1.
2. Update Section 6 ("The 8 Anomaly Detection Engines") to reflect the actual current engine count once Q1.5, Q2.1, and Q3.1 have landed, using the same formulaic documentation style already used for engines 1–8 — this consistency of documentation quality is itself a credibility signal to preserve.
3. Update the RBAC matrix (Section 8.1) to confirm the new `POST /api/v1/inspections` endpoint (Q2.1) is scoped correctly.
4. Add a "Data Provenance" section to `Project-Report.md` stating explicitly, for every dataset in Section 5.1, whether it is real government data, synthetic/demo data, or a mix — extending the "Demo Dataset" labeling discipline already established elsewhere in this project into the technical documentation.

## Q4.2 — Full acceptance-criteria regression pass
Before considering this roadmap complete, re-verify every acceptance criterion stated in Q1 through Q3 against the live product, not against memory of having implemented the associated code. Where any criterion fails, treat it as an open item rather than closing this roadmap.

## Q4.3 — Future Work (explicitly out of scope for this roadmap — recorded so it is not lost or silently re-promised)
These were raised during project review as genuinely valuable but were deliberately not scheduled into Q1–Q3, either because they require data this system doesn't yet have, or because they're too large to build confidently on synthetic data in this timeframe. Do not build these without an explicit decision to add a new quarter.

1. **Cross-constituency contractor/vendor network analysis** — identifying a contractor or agency operating under multiple names across different constituencies with a shared pattern of poor outcomes. Requires national-scale entity-resolution work beyond a single constituency's data and is not buildable convincingly on synthetic data at this time. This is directly related to the "Ghost Vendor & Shell Network Detector" concept flagged on the landing page in Q1.4, item 5 — resolve that item's outcome (a) vs. (b) decision first; if outcome (b) was chosen there, this Future Work entry is where that concept now formally lives instead of the public landing page.
2. **Citizen complaint text-mining** — clustering public complaint text against project IDs to surface ground-truth signals financial data alone doesn't capture. Requires a real complaint-intake data source that does not currently exist in the system; do not simulate this with synthetic complaint text presented as if it were real.

---

## Cross-Cutting Rules (apply throughout all four quarters)

- **Naming consistency:** once Q1.1 confirms the canonical table/field names for MP and constituency records, use those exact names in every subsequent quarter's schema references — do not reintroduce alternate names for the same concept.
- **Widget budget:** see Verification Rule 5 above; applies to every dashboard change in Q1, Q2, and Q3.
- **No claim without a corresponding, checkable implementation:** every new detector, compliance rule, or predictive feature must be traceable from its UI-facing claim back to the exact code path that produces it. This is the same standard applied throughout the earlier PPT and architecture review, and it applies equally to code, not just slides.
