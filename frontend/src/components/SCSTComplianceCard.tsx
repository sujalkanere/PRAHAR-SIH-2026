import React from 'react'
import { Card, Progress, Tag, Space, Typography, Row, Col } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

const { Text } = Typography

export interface SCSTComplianceData {
  id?: string
  financial_year: string
  sc_pct_actual: number
  sc_pct_target: number
  st_pct_actual: number
  st_pct_target: number
  status: 'COMPLIANT' | 'AT_RISK' | 'VIOLATION' | string
  calculated_at?: string
}

interface Props {
  data?: SCSTComplianceData | null
  loading?: boolean
  style?: React.CSSProperties
  compact?: boolean
}

export const SCSTComplianceCard: React.FC<Props> = ({ data, loading, style, compact = false }) => {
  const scActual = data?.sc_pct_actual ?? 0
  const scTarget = data?.sc_pct_target ?? 15.0
  const stActual = data?.st_pct_actual ?? 0
  const stTarget = data?.st_pct_target ?? 7.5
  const status = data?.status ?? 'COMPLIANT'

  const getStatusBadge = () => {
    switch (status) {
      case 'COMPLIANT':
        return (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 600, padding: '2px 8px' }}>
            Statutory Quotas Met
          </Tag>
        )
      case 'AT_RISK':
        return (
          <Tag color="warning" icon={<ExclamationCircleOutlined />} style={{ fontWeight: 600, padding: '2px 8px' }}>
            Allocation At Risk
          </Tag>
        )
      case 'VIOLATION':
        return (
          <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontWeight: 600, padding: '2px 8px' }}>
            Statutory Shortfall
          </Tag>
        )
      default:
        return <Tag>{status}</Tag>
    }
  }

  const getProgressStroke = (actual: number, target: number) => {
    if (actual >= target) return '#10b981'
    if (actual >= target * 0.7) return '#f59e0b'
    return '#ef4444'
  }

  const scPctOfTarget = Math.min(100, Math.round((scActual / scTarget) * 100))
  const stPctOfTarget = Math.min(100, Math.round((stActual / stTarget) * 100))

  return (
    <Card
      loading={loading}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: '1px solid var(--border-primary)',
        boxShadow: 'var(--card-shadow)',
        ...style,
      }}
      bodyStyle={{ padding: compact ? '16px' : '20px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <SafetyCertificateOutlined style={{ fontSize: '18px', color: '#6366f1' }} />
          <div>
            <Text strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              SC / ST Statutory Allocation Quotas
            </Text>
            {data?.financial_year && (
              <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                FY {data.financial_year} &bull; MPLADS Guidelines (15% SC, 7.5% ST)
              </Text>
            )}
          </div>
        </Space>
        {getStatusBadge()}
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'var(--bg-surface-elevated, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-secondary, rgba(255,255,255,0.06))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Scheduled Caste (SC)
              </Text>
              <Text strong style={{ fontSize: '13px', color: getProgressStroke(scActual, scTarget) }}>
                {scActual.toFixed(1)}% <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ {scTarget.toFixed(1)}%</span>
              </Text>
            </div>
            <Progress
              percent={scPctOfTarget}
              strokeColor={getProgressStroke(scActual, scTarget)}
              showInfo={false}
              size="small"
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
              {scActual >= scTarget ? (
                <span style={{ color: '#10b981' }}>+{(scActual - scTarget).toFixed(1)}% over statutory mandate</span>
              ) : (
                <span style={{ color: scActual >= scTarget * 0.7 ? '#f59e0b' : '#ef4444' }}>
                  {(scTarget - scActual).toFixed(1)}% shortfall below mandate
                </span>
              )}
            </div>
          </div>
        </Col>

        <Col span={12}>
          <div
            style={{
              padding: '12px',
              borderRadius: 8,
              background: 'var(--bg-surface-elevated, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-secondary, rgba(255,255,255,0.06))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Scheduled Tribe (ST)
              </Text>
              <Text strong style={{ fontSize: '13px', color: getProgressStroke(stActual, stTarget) }}>
                {stActual.toFixed(1)}% <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ {stTarget.toFixed(1)}%</span>
              </Text>
            </div>
            <Progress
              percent={stPctOfTarget}
              strokeColor={getProgressStroke(stActual, stTarget)}
              showInfo={false}
              size="small"
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
              {stActual >= stTarget ? (
                <span style={{ color: '#10b981' }}>+{(stActual - stTarget).toFixed(1)}% over statutory mandate</span>
              ) : (
                <span style={{ color: stActual >= stTarget * 0.7 ? '#f59e0b' : '#ef4444' }}>
                  {(stTarget - stActual).toFixed(1)}% shortfall below mandate
                </span>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  )
}
