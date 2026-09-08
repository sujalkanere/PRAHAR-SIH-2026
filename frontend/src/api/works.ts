import { apiClient } from './client'
import { Work } from '../types'

export interface WorkListParams {
  constituency_id?: string
  work_category?: string
  work_status?: string
  financial_year?: string
  risk_tier?: string
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

export interface WorkListResponse {
  data: Work[]
  pagination: {
    page: number
    per_page: number
    total_records: number
    total_pages: number
  }
}

export interface CreateWorkPayload {
  constituency_id: string
  work_description: string
  work_category: string
  sanctioned_amount: number
  actual_expenditure?: number
  sanction_date: string
  expected_completion_date?: string
  completion_date?: string
  work_status?: string
  implementing_agency?: string
  financial_year?: string
  latitude?: number
  longitude?: number
}

export const worksApi = {
  list: async (params?: WorkListParams): Promise<WorkListResponse> => {
    const { data } = await apiClient.get<WorkListResponse>('/works', { params })
    return data
  },

  getDetail: async (id: string): Promise<Work> => {
    const { data } = await apiClient.get<Work>(`/works/${id}`)
    return data
  },

  create: async (payload: CreateWorkPayload): Promise<Work> => {
    const { data } = await apiClient.post<Work>('/works', payload)
    return data
  },
}
