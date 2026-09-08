import { apiClient } from './client'
import { DetectionRun, UploadHistoryItem } from '../types'

export interface SyntheticParams {
  num_constituencies: number
  num_works_per_constituency: number
  anomaly_injection_rate: number
  seed: number
}

export const adminApi = {
  generateSynthetic: async (params: SyntheticParams) => {
    const { data } = await apiClient.post('/admin/generate-synthetic', params)
    return data
  },

  uploadFile: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post('/admin/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },

  triggerDetection: async () => {
    const { data } = await apiClient.post<{ message: string; status: string; triggered_at: string }>(
      '/admin/run-detection'
    )
    return data
  },

  getDetectionHistory: async (): Promise<DetectionRun[]> => {
    const { data } = await apiClient.get<any>('/admin/detection-runs')
    return Array.isArray(data) ? data : (data?.data || [])
  },

  getUploadHistory: async (): Promise<UploadHistoryItem[]> => {
    const { data } = await apiClient.get<any>('/admin/uploads')
    return Array.isArray(data) ? data : (data?.data || [])
  },

  resetDefault: async () => {
    const { data } = await apiClient.post<{ message: string; constituencies: number; works: number; fund_releases: number }>(
      '/admin/reset-default'
    )
    return data
  },
}
