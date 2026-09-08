import { apiClient } from './client'

export interface ReportRequest {
  scope: 'NATIONAL' | 'STATE' | 'CONSTITUENCY'
  scope_id?: string
  financial_year?: string
  anomaly_types?: string[]
  severity_filter?: string[]
  format: 'PDF' | 'CSV'
}

export const reportsApi = {
  generateReport: async (params: ReportRequest): Promise<{ report_id: string; download_url: string }> => {
    const { data } = await apiClient.post('/reports/generate', params)
    return data
  },

  downloadReport: async (downloadUrl: string, filename: string) => {
    const cleanUrl = downloadUrl.startsWith('/api/v1')
      ? downloadUrl.replace(/^\/api\/v1/, '')
      : downloadUrl
    const response = await apiClient.get(cleanUrl, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}
