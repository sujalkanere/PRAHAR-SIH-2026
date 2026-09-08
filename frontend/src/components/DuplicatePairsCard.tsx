import React from 'react'
import { Card, Progress, Space, Tag, Typography } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { DuplicatePair } from '../types'
import { RiskBadge } from './RiskBadge'

const { Text } = Typography

interface DuplicatePairsCardProps {
  pairs: DuplicatePair[]
}

export const DuplicatePairsCard: React.FC<DuplicatePairsCardProps> = ({ pairs }) => {
  if (!pairs || pairs.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          color: '#64748b',
        }}
      >
        No potential duplicate work pairs detected in this constituency.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {pairs.map((pair, idx) => (
        <Card
          key={`${pair.work_a_ref}-${pair.work_b_ref}-${idx}`}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
          }}
          bodyStyle={{ padding: '18px 20px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              borderBottom: '1px solid #f1f5f9',
              paddingBottom: 10,
            }}
          >
            <Space>
              <Tag color="purple" style={{ fontWeight: 600 }}>
                DUPLICATE DETECTED
              </Tag>
              <RiskBadge tier={pair.severity} />
            </Space>

            <div style={{ textAlign: 'right' }}>
              <Text style={{ color: '#64748b', fontSize: '12px' }}>Composite Score: </Text>
              <Text style={{ color: '#db2777', fontWeight: 700, fontSize: '15px' }}>
                {pair.composite_score} / 100
              </Text>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
            {/* Work A */}
            <div
              style={{
                background: '#f8fafc',
                padding: '14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '13px', marginBottom: 6 }}>
                {pair.work_a_ref}
              </div>
              <div style={{ color: '#334155', fontSize: '13px', lineHeight: '1.5' }}>
                {pair.work_a_description}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b' }}>
              <SwapOutlined style={{ fontSize: '20px' }} />
            </div>

            {/* Work B */}
            <div
              style={{
                background: '#f8fafc',
                padding: '14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ color: '#2563eb', fontWeight: 700, fontSize: '13px', marginBottom: 6 }}>
                {pair.work_b_ref}
              </div>
              <div style={{ color: '#334155', fontSize: '13px', lineHeight: '1.5' }}>
                {pair.work_b_description}
              </div>
            </div>
          </div>

          {/* Similarity Meters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: 2 }}>
                <span>Semantic Text Similarity</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{Math.round(pair.text_similarity * 100)}%</span>
              </div>
              <Progress percent={Math.round(pair.text_similarity * 100)} showInfo={false} strokeColor="#9333ea" />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: 2 }}>
                <span>Sanction Amount Similarity</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{Math.round(pair.amount_similarity * 100)}%</span>
              </div>
              <Progress percent={Math.round(pair.amount_similarity * 100)} showInfo={false} strokeColor="#2563eb" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
