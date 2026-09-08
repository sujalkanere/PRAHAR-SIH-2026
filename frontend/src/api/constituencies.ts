import { apiClient } from './client'
import { ConstituencyDetailData, ConstituencySummary } from '../types'

export const constituenciesApi = {
  list: async (params?: {
    state?: string
    district?: string
    risk_tier?: string
    search?: string
  }): Promise<{ data: ConstituencySummary[]; total: number }> => {
    const { data } = await apiClient.get<{ data: ConstituencySummary[]; total: number }>('/constituencies', {
      params,
    })
    return data
  },

  getDetail: async (id: string, financialYear?: string): Promise<ConstituencyDetailData> => {
    const { data } = await apiClient.get<ConstituencyDetailData>(`/constituencies/${id}`, {
      params: financialYear ? { financial_year: financialYear } : undefined,
    })
    return data
  },
}
