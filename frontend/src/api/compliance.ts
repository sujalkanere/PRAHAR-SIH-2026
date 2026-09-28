/**
 * Compliance API client functions.
 */
import { apiClient } from './client';

export interface ComplianceSummary {
  total_works_scanned: number;
  passed_works: number;
  failed_works: number;
  compliance_pass_rate_pct: number;
  composite_health_index?: number;
  total_active_alerts: number;
  total_amount_at_risk: number;
  sc_quota_compliance_pct: number;
  st_quota_compliance_pct: number;
  sc_mandate_target_pct: number;
  st_mandate_target_pct: number;
  pillar_scores?: {
    eligibility_score: number;
    social_equity_score: number;
    execution_score: number;
    financial_score: number;
  };
  total_rules_active?: number;
  last_scanned_at: string;
}

export interface RulebookItem {
  id: string;
  pillar?: string;
  category: string;
  name: string;
  guideline_section: string;
  severity: string;
  description: string;
  condition: string;
  suggested_action: string;
  legal_reference?: string;
  violations_detected: number;
  status: 'PASSED' | 'VIOLATED';
}

export interface ComplianceAlert {
  alert_id: string;
  work_id: string;
  work_code: string;
  work_title: string;
  constituency_id: string;
  constituency_name: string;
  state: string;
  mp_name: string;
  rule_id: string;
  rule_name: string;
  pillar?: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  guideline_section: string;
  violation_details: string;
  amount_involved: number;
  suggested_action: string;
  detected_at: string;
}

export interface ScStQuotaItem {
  constituency_id: string;
  constituency_name: string;
  state: string;
  mp_name: string;
  total_sanctioned: number;
  sc_allocation: number;
  sc_percentage: number;
  sc_target_pct: number;
  sc_compliant: boolean;
  sc_shortfall_rupees?: number;
  st_allocation: number;
  st_percentage: number;
  st_target_pct: number;
  st_compliant: boolean;
  st_shortfall_rupees?: number;
  remedy?: string;
}

export interface SimulateWorkPayload {
  work_description: string;
  work_category: string;
  sanctioned_amount: number;
  beneficiary_type?: string;
  land_status?: string;
  is_sc_area?: boolean;
  is_st_area?: boolean;
  has_tech_clearance?: boolean;
  annual_cumulative_sanctions?: number;
}

export interface SimulateWorkResult {
  certificate_id?: string;
  verdict: string;
  is_compliant: boolean;
  total_rules_checked: number;
  rules_passed: number;
  rules_violated: number;
  violations: Array<{
    rule_id: string;
    name: string;
    severity: string;
    guideline_section: string;
    reason: string;
    action: string;
  }>;
  advisories?: Array<{ rule_id: string; message: string }>;
  checklist?: Array<{
    clause: string;
    description: string;
    status: string;
    citation: string;
  }>;
  sc_st_credit: string;
  proposed_amount?: number;
  cumulative_sanctions_after?: number;
  official_authority?: string;
  evaluated_at: string;
}

export async function fetchComplianceSummary(): Promise<ComplianceSummary> {
  const res = await apiClient.get<ComplianceSummary>('/compliance/summary');
  return res.data;
}

export async function fetchComplianceRules(): Promise<{ total_rules: number; rules: RulebookItem[] }> {
  const res = await apiClient.get<{ total_rules: number; rules: RulebookItem[] }>('/compliance/rules');
  return res.data;
}

export async function fetchComplianceAlerts(severity?: string, category?: string): Promise<{ total_alerts: number; alerts: ComplianceAlert[] }> {
  const res = await apiClient.get<{ total_alerts: number; alerts: ComplianceAlert[] }>('/compliance/alerts', {
    params: { severity, category },
  });
  return res.data;
}

export async function fetchScStQuotas(): Promise<{ sc_mandate_target_pct: number; st_mandate_target_pct: number; total_constituencies: number; quotas: ScStQuotaItem[] }> {
  const res = await apiClient.get('/compliance/sc-st-quotas');
  return res.data;
}

export async function simulateWorkCompliance(payload: SimulateWorkPayload): Promise<SimulateWorkResult> {
  const res = await apiClient.post<SimulateWorkResult>('/compliance/simulate', payload);
  return res.data;
}

export async function rescanCompliance(): Promise<{ status: string; message: string; summary: ComplianceSummary }> {
  const res = await apiClient.post<{ status: string; message: string; summary: ComplianceSummary }>('/compliance/rescan');
  return res.data;
}

export const complianceApi = {
  getSummary: fetchComplianceSummary,
  getRules: fetchComplianceRules,
  getAlerts: fetchComplianceAlerts,
  getScStQuotas: fetchScStQuotas,
  simulateWork: simulateWorkCompliance,
  rescan: rescanCompliance,
  getSCST: async (params?: any) => {
    const res = await apiClient.get('/compliance/sc-st', { params });
    return res.data;
  },
  getInspections: async (params?: any) => {
    const res = await apiClient.get('/compliance/inspections', { params });
    return res.data;
  },
  createInspection: async (data: any) => {
    const res = await apiClient.post('/compliance/inspections', data);
    return res.data;
  },
  getCoverage: async (params?: any) => {
    const res = await apiClient.get('/compliance/inspection-coverage', { params });
    return res.data;
  },
};

