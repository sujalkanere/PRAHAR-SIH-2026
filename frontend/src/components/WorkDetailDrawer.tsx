import React from 'react'
import { Drawer, Descriptions, Divider, Progress, Space, Typography } from 'antd'
import { Work } from '../types'
import { RiskBadge } from './RiskBadge'

const { Title, Text } = Typography

interface WorkDetailDrawerProps {
  work: Work | null
  open: boolean
  onClose: () => void
}

export const WorkDetailDrawer: React.FC<WorkDetailDrawerProps> = ({ work, open, onClose }) => {
  if (!work) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val)
  }

  const overrun = work.cost_overrun_percentage || 0
  const isOverrun = overrun > 0

  return (
    <Drawer
      title={
        <Space direction="vertical" size={2}>
          <Space>
            <Text style={{ color: '#3b82f6', fontWeight: 700, fontSize: '15px' }}>{work.work_id}</Text>
            <RiskBadge tier={work.risk_tier} score={work.risk_score} showScore />
          </Space>
          <Text style={{ color: '#94a3b8', fontSize: '12px' }}>
            {work.work_category} &bull; FY {work.financial_year}
          </Text>
        </Space>
      }
      placement="right"
      width={560}
      onClose={onClose}
      open={open}
      bodyStyle={{ background: '#0d1527', color: '#e2e8f0', padding: '24px' }}
    >
      <div style={{ marginBottom: 20 }}>
        <Title level={5} style={{ color: '#f1f5f9', marginBottom: 8 }}>
          Work Description
        </Title>
        <div
          style={{
            background: '#131b2e',
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #1f2d4d',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#cbd5e1',
          }}
        >
          {work.work_description}
        </div>
      </div>

      <Divider style={{ borderColor: '#1f2d4d' }} />

      <Title level={5} style={{ color: '#f1f5f9', marginBottom: 12 }}>
        Financial Breakdown
      </Title>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: 16 }}>
        <div style={{ background: '#131b2e', padding: '12px', borderRadius: 8, border: '1px solid #1f2d4d' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>Sanctioned Amount</div>
          <div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
            {formatCurrency(work.sanctioned_amount)}
          </div>
        </div>

        <div style={{ background: '#131b2e', padding: '12px', borderRadius: 8, border: '1px solid #1f2d4d' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>Actual Expenditure</div>
          <div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 700, marginTop: 4 }}>
            {formatCurrency(work.actual_expenditure)}
          </div>
        </div>
      </div>

      <div style={{ background: '#131b2e', padding: '12px 16px', borderRadius: 8, border: '1px solid #1f2d4d', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Cost Variance</span>
          <span style={{ fontWeight: 700, color: isOverrun ? '#ef4444' : '#10b981' }}>
            {isOverrun ? `+${overrun}% Overrun` : `${overrun}% Variance`}
          </span>
        </div>
        <Progress
          percent={Math.min(100, Math.max(0, 100 + overrun))}
          status={isOverrun ? 'exception' : 'success'}
          strokeColor={isOverrun ? '#ef4444' : '#10b981'}
          showInfo={false}
        />
      </div>

      <Divider style={{ borderColor: '#1f2d4d' }} />

      <Title level={5} style={{ color: '#f1f5f9', marginBottom: 12 }}>
        Execution & Timelines
      </Title>

      <Descriptions
        column={1}
        size="small"
        bordered
        contentStyle={{ background: '#131b2e', color: '#cbd5e1' }}
        labelStyle={{ background: '#0f182c', color: '#94a3b8', width: '40%' }}
      >
        <Descriptions.Item label="Status">
          <span style={{ fontWeight: 600, color: work.work_status === 'COMPLETED' ? '#10b981' : '#f59e0b' }}>
            {work.work_status}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="Sanction Date">{work.sanction_date}</Descriptions.Item>
        <Descriptions.Item label="Expected Completion">
          {work.expected_completion_date || 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Actual Completion">
          {work.completion_date || 'In Progress'}
        </Descriptions.Item>
        <Descriptions.Item label="Implementing Agency">
          {work.implementing_agency || 'Not Specified'}
        </Descriptions.Item>
        <Descriptions.Item label="Coordinates">
          {work.latitude && work.longitude ? `${work.latitude.toFixed(4)}, ${work.longitude.toFixed(4)}` : 'Not Tagged'}
        </Descriptions.Item>
      </Descriptions>

      {work.risk_components && (
        <>
          <Divider style={{ borderColor: '#1f2d4d' }} />
          <Title level={5} style={{ color: '#f1f5f9', marginBottom: 12 }}>
            Risk Component Scores
          </Title>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>Cost Overrun (Max 25)</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{work.risk_components.cost_overrun} / 25</span>
              </div>
              <Progress percent={(work.risk_components.cost_overrun / 25) * 100} showInfo={false} strokeColor="#ef4444" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>Delay & Stalling (Max 25)</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{work.risk_components.delay} / 25</span>
              </div>
              <Progress percent={(work.risk_components.delay / 25) * 100} showInfo={false} strokeColor="#f97316" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>Duplicate Probability (Max 25)</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{work.risk_components.duplicate} / 25</span>
              </div>
              <Progress percent={(work.risk_components.duplicate / 25) * 100} showInfo={false} strokeColor="#a855f7" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>Suspicious Pattern (Max 15)</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{work.risk_components.pattern} / 15</span>
              </div>
              <Progress percent={(work.risk_components.pattern / 15) * 100} showInfo={false} strokeColor="#eab308" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
                <span>Fund Utilization Discrepancy (Max 10)</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{work.risk_components.fund_utilization} / 10</span>
              </div>
              <Progress percent={(work.risk_components.fund_utilization / 10) * 100} showInfo={false} strokeColor="#3b82f6" />
            </div>
          </div>
        </>
      )}
    </Drawer>
  )
}
