import React from 'react'
import { Card, Statistic } from 'antd'

interface KPICardProps {
  title: string
  value: number | string
  prefix?: React.ReactNode
  suffix?: string
  color?: string
  subtitle?: string
  trend?: string
  trendType?: 'up' | 'down' | 'neutral'
  onClick?: () => void
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  prefix,
  suffix,
  color = '#1d4ed8',
  subtitle,
  onClick,
}) => {
  return (
    <Card
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      styles={{ body: { padding: '20px' } }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: color,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            color: '#475569',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
        {prefix && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${color}15`,
              color: color,
              fontSize: '18px',
            }}
          >
            {prefix}
          </div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <Statistic
          value={value}
          suffix={suffix}
          valueStyle={{
            color: '#0f172a',
            fontWeight: 800,
            fontSize: '28px',
            fontFamily: 'Outfit, sans-serif',
          }}
        />
      </div>

      {subtitle && (
        <div style={{ marginTop: 6, fontSize: '12px', color: '#475569' }}>
          {subtitle}
        </div>
      )}
    </Card>
  )
}

export default KPICard
