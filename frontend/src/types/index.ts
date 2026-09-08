export type Role =
  | 'ROLE_ADMIN'
  | 'ROLE_MINISTRY'
  | 'ROLE_STATE_NODAL'
  | 'ROLE_DISTRICT'
  | 'ROLE_MP'
  | 'ROLE_PUBLIC'

export interface User {
  id: string
  username: string
  full_name: string
  role: Role
  scope_type: 'NATIONAL' | 'STATE' | 'DISTRICT' | 'CONSTITUENCY' | 'NONE'
  scope_value: string | null
}

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type AnomalyStatus = 'NEW' | 'ACKNOWLEDGED' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE'

export interface Anomaly {
  id: string
  work_id: string | null
  work_ref: string | null
  constituency_id: string
  constituency_name: string | null
  state: string | null
  anomaly_type: string
  category: string
  severity: AnomalySeverity
  confidence_score: number
  detection_method: string
  details: Record<string, any> | null
  status: AnomalyStatus
  note: string | null
  detected_at: string
}

export interface Work {
  id: string
  work_id: string
  constituency_id: string
  constituency_name?: string
  state?: string
  work_description: string
  work_category: string
  sanctioned_amount: number
  actual_expenditure: number
  cost_overrun_percentage: number
  sanction_date: string
  expected_completion_date: string | null
  completion_date: string | null
  work_status: string
  implementing_agency: string | null
  financial_year: string
  latitude: number | null
  longitude: number | null
  risk_score: number
  risk_tier: RiskTier
  risk_components: {
    cost_overrun: number
    delay: number
    duplicate: number
    pattern: number
    fund_utilization: number
  } | null
}

export interface DuplicatePair {
  work_a_ref: string
  work_b_ref: string
  work_a_description: string
  work_b_description: string
  text_similarity: number
  amount_similarity: number
  composite_score: number
  severity: AnomalySeverity
  detected_at: string
}

export interface ConstituencySummary {
  id: string
  name: string
  state: string
  district: string | null
  mp_name: string | null
  risk_score: number | null
  risk_tier: RiskTier | null
  total_works: number
  total_expenditure: number
  total_funds_released: number
  fund_utilization_rate: number | null
  active_anomalies: number
  financial_year: string | null
}

export interface StateSummaryItem {
  state: string
  avg_risk: number
  constituencies: number
  works: number
  expenditure_cr: number
  released_cr: number
  high_risk: number
  anomalies: number
}

export interface NationalSummaryData {
  kpis: Array<{
    key: string
    label: string
    value: any
    format: string
  }>
  risk_distribution: Record<RiskTier, number>
  anomaly_distribution: Record<string, number>
  top_risky_constituencies: Array<{
    id: string
    name: string
    state: string
    district: string
    mp_name: string | null
    risk_score: number
    risk_tier: RiskTier
    total_works: number
    high_risk_works: number
    fund_utilization_rate: number | null
    total_funds_released: number
    total_expenditure: number
  }>
  trends: Array<{
    financial_year: string
    cost_overrun: number
    delay: number
    duplicate: number
    pattern: number
    fund_utilization: number
    total: number
  }>
  state_summaries: StateSummaryItem[]
  recent_alerts: Anomaly[]
}

export interface ConstituencyDetailData {
  constituency: ConstituencySummary
  radar_data?: {
    cost_overrun: number
    delay: number
    duplicate: number
    pattern: number
    fund_utilization: number
  }
  risk?: {
    risk_score?: number
    risk_tier?: RiskTier
    total_works?: number
    total_funds_released?: number
    total_expenditure?: number
    fund_utilization_rate?: number | null
  }
  risk_components_avg?: {
    cost_overrun: number
    delay: number
    duplicate: number
    pattern: number
    fund_utilization: number
  }
  expenditure_timeline: Array<{
    financial_year?: string
    month?: string
    expenditure: number
    released?: number
    fund_utilization_rate?: number
  }>
  duplicate_pairs: DuplicatePair[]
  anomalies: Anomaly[]
}

export interface AuditTrailItem {
  action: string
  performed_by: string | null
  timestamp: string
  old_value: any
  new_value: any
  note: string | null
}

export interface DetectionRun {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  trigger_type: string
  anomalies_detected: number
  works_analyzed: number
  started_at: string
  completed_at: string | null
  error_message: string | null
}

export interface UploadHistoryItem {
  id: string
  filename: string
  file_size_bytes: number
  records_total: number
  records_valid: number
  records_rejected: number
  validation_errors: Array<{
    row_number: number
    column: string
    error_message: string
  }>
  status: string
  uploaded_at: string
  completed_at: string | null
}
