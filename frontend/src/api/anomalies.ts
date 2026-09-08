import { apiClient } from './client'
import { Anomaly, AuditTrailItem } from '../types'

export interface AnomalyListParams {
  constituency_id?: string
  anomaly_type?: string
  severity?: string
  status?: string
  financial_year?: string
  page?: number
  per_page?: number
}

export interface AnomalyListResponse {
  data: Anomaly[]
  pagination: {
    page: number
    per_page: number
    total_records: number
    total_pages: number
  }
}

export interface AnomalyDetailResponse {
  anomaly: Anomaly
  audit_trail: AuditTrailItem[]
}

export const anomaliesApi = {
  list: async (params?: AnomalyListParams): Promise<AnomalyListResponse> => {
    const { data } = await apiClient.get<AnomalyListResponse>('/anomalies', { params })
    return data
  },

  getDetail: async (id: string): Promise<AnomalyDetailResponse> => {
    const { data } = await apiClient.get<AnomalyDetailResponse>(`/anomalies/${id}`)
    return data
  },

  getAuditTrail: async (id: string): Promise<AuditTrailItem[]> => {
    const { data } = await apiClient.get<AnomalyDetailResponse>(`/anomalies/${id}`)
    return data.audit_trail || []
  },

  updateStatus: async (
    id: string,
    body: { status: string; note?: string }
  ): Promise<Anomaly> => {
    const { data } = await apiClient.patch<Anomaly>(`/anomalies/${id}`, body)
    return data
  },
}
