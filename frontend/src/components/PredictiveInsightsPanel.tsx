import React, { useEffect, useState } from 'react'
import { Card, List, Tag, Typography, Spin, Collapse } from 'antd'
import { LineChartOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { apiClient } from '../api/client'

const { Text } = Typography

interface PredictiveInsightsPanelProps {
  state?: string
  district?: string
  constituencyId?: string
}

export const PredictiveInsightsPanel: React.FC<PredictiveInsightsPanelProps> = ({ state, district, constituencyId }) => {
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])

  useEffect(() => {
    loadPredictions()
  }, [state, district, constituencyId])

  const loadPredictions = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (state) params.state = state
      if (district) params.district = district
      if (constituencyId) params.constituency_id = constituencyId

      const res = await apiClient.get('/analytics/predictions', { params })
      setPredictions(res.data?.predictions || [])
    } catch (err) {
      console.error('Failed to load predictions', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card title="Predictive Insights" style={{ borderRadius: 12, border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin />
        </div>
      </Card>
    )
  }

  if (predictions.length === 0) {
    return (
      <Card title="Predictive Insights" style={{ borderRadius: 12, border: '1px solid var(--border-primary)' }}>
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          No statistical alerts active for this scope.
        </div>
      </Card>
    )
  }

  return (
    <Card 
      title={<><InfoCircleOutlined style={{ marginRight: 8, color: '#3b82f6' }} />Predictive Insights</>}
      style={{ borderRadius: 12, border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}
      bodyStyle={{ padding: 0 }}
    >
      <List
        dataSource={predictions}
        renderItem={item => {
          const isPace = item.type === 'FUND_UTILIZATION_PACE'
          return (
            <List.Item style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ 
                    marginTop: 4, 
                    color: isPace ? '#d97706' : '#dc2626',
                    fontSize: 20
                  }}>
                    {isPace ? <LineChartOutlined /> : <ClockCircleOutlined />}
                  </div>
                  <div style={{ flex: 1 }}>
                    {item.work_title && (
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {item.work_title} <Tag style={{ marginLeft: 8 }}>{item.category}</Tag>
                      </div>
                    )}
                    <Text strong={!item.work_title} style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                      {item.message}
                    </Text>
                    
                    <Collapse ghost size="small" style={{ marginTop: 8 }}>
                      <Collapse.Panel header={<Text style={{ color: '#2563eb', fontSize: 12 }}>View Methodology</Text>} key="1">
                        <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, fontSize: 12 }}>
                          <div><strong>Method:</strong> <Tag color="blue">{item.method}</Tag></div>
                          <div style={{ marginTop: 4 }}><strong>Data Window:</strong> <Text type="secondary">{item.data_window}</Text></div>
                          {item.projected_utilization_pct !== undefined && (
                            <div style={{ marginTop: 4 }}><strong>Projected Yr-End:</strong> {item.projected_utilization_pct}%</div>
                          )}
                          {item.historical_median_days !== undefined && (
                            <div style={{ marginTop: 4 }}>
                              <strong>Elapsed Days:</strong> {item.elapsed_days} (Median: {item.historical_median_days})
                            </div>
                          )}
                        </div>
                      </Collapse.Panel>
                    </Collapse>
                  </div>
                </div>
              </div>
            </List.Item>
          )
        }}
      />
    </Card>
  )
}
