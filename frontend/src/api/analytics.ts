import { apiClient } from './client'
import { NationalSummaryData } from '../types'

export const analyticsApi = {
  getNationalSummary: async (): Promise<NationalSummaryData> => {
    const { data } = await apiClient.get<NationalSummaryData>('/analytics/national-summary')
    return data
  },

  getStateSummary: async (stateName: string) => {
    const { data } = await apiClient.get(`/analytics/state/${encodeURIComponent(stateName)}`)
    return data
  },

  getDistrictSummary: async (districtName: string) => {
    const { data } = await apiClient.get(`/analytics/district/${encodeURIComponent(districtName)}`)
    return data
  },

  getTrends: async (params?: { constituency_id?: string; state?: string }) => {
    const { data } = await apiClient.get('/analytics/trends', { params })
    return data
  },
}
