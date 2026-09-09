import React from 'react'
import { Card } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

export type KPIColorTheme = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose' | 'default'

interface KPICardProps {
  title: string
  value: number | string
  prefix?: React.ReactNode
  suffix?: string
  color?: string
  subtitle?: string
  badgeText?: string
  badgeType?: 'positive' | 'negative' | 'neutral'
  trendDirection?: 'up' | 'down'
  theme?: KPIColorTheme
  onClick?: () => void
}

const THEME_STYLES: Record<KPIColorTheme, {
  topBar: string
  bgGradient: string
  borderColor: string
  borderHover: string
  titleColor: string
  valueColor: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
  circleBg: string
  circleColor: string
  glow: string
}> = {
  blue: {
    topBar: 'linear-gradient(90deg, #2563eb, #60a5fa)',
    bgGradient: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 85%)',
    borderColor: '#bfdbfe',
    borderHover: '#93c5fd',
    titleColor: '#1d4ed8',
    valueColor: '#1e3a8a',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
    badgeBorder: '#93c5fd',
    circleBg: '#dbeafe',
    circleColor: '#2563eb',
    glow: 'rgba(37, 99, 235, 0.18)',
  },
  emerald: {
    topBar: 'linear-gradient(90deg, #059669, #34d399)',
    bgGradient: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 85%)',
    borderColor: '#a7f3d0',
    borderHover: '#6ee7b7',
    titleColor: '#047857',
    valueColor: '#064e3b',
    badgeBg: '#d1fae5',
    badgeText: '#047857',
    badgeBorder: '#6ee7b7',
    circleBg: '#d1fae5',
    circleColor: '#059669',
    glow: 'rgba(5, 150, 105, 0.18)',
  },
  purple: {
    topBar: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    bgGradient: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 85%)',
    borderColor: '#ddd6fe',
    borderHover: '#c4b5fd',
    titleColor: '#6d28d9',
    valueColor: '#4c1d95',
    badgeBg: '#ede9fe',
    badgeText: '#6d28d9',
    badgeBorder: '#c4b5fd',
    circleBg: '#ede9fe',
    circleColor: '#7c3aed',
    glow: 'rgba(124, 58, 237, 0.18)',
  },
  amber: {
    topBar: 'linear-gradient(90deg, #d97706, #fbbf24)',
    bgGradient: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 85%)',
    borderColor: '#fde68a',
    borderHover: '#fcd34d',
    titleColor: '#b45309',
    valueColor: '#78350f',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
    badgeBorder: '#fcd34d',
    circleBg: '#fef3c7',
    circleColor: '#d97706',
    glow: 'rgba(217, 119, 6, 0.18)',
  },
  rose: {
    topBar: 'linear-gradient(90deg, #e11d48, #fb7185)',
    bgGradient: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 85%)',
    borderColor: '#fecdd3',
    borderHover: '#fda4af',
    titleColor: '#be123c',
    valueColor: '#881337',
    badgeBg: '#ffe4e6',
    badgeText: '#be123c',
    badgeBorder: '#fda4af',
    circleBg: '#ffe4e6',
    circleColor: '#e11d48',
    glow: 'rgba(225, 29, 72, 0.18)',
  },
  default: {
    topBar: 'transparent',
    bgGradient: '#ffffff',
    borderColor: '#edf0f2',
    borderHover: '#e2e8f0',
    titleColor: '#64748b',
    valueColor: '#0f172a',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    badgeBorder: '#e2e8f0',
    circleBg: '#f1f5f9',
    circleColor: '#64748b',
    glow: 'rgba(0, 0, 0, 0.05)',
  },
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  prefix,
  suffix,
  color,
  subtitle,
  badgeText,
  badgeType = 'positive',
  trendDirection = 'up',
  theme = 'default',
  onClick,
}) => {
  const t = THEME_STYLES[theme] || THEME_STYLES.default

  const isPositive = badgeType === 'positive'
  const isNegative = badgeType === 'negative'

  // If theme is default, use standard status colors; if theme is colored, use theme colors
  const badgeBg = theme !== 'default' ? t.badgeBg : (isPositive ? '#e8f8f0' : isNegative ? '#fef2f2' : '#f1f5f9')
  const badgeColor = theme !== 'default' ? t.badgeText : (isPositive ? '#15803d' : isNegative ? '#dc2626' : '#475569')
  const badgeBorder = theme !== 'default' ? `1px solid ${t.badgeBorder}` : 'none'

  const circleBg = theme !== 'default' ? t.circleBg : (trendDirection === 'up' ? '#ecfdf5' : '#fef2f2')
  const circleColor = theme !== 'default' ? t.circleColor : (trendDirection === 'up' ? '#10b981' : '#ef4444')

  return (
    <Card
      onClick={onClick}
      style={{
        position: 'relative',
        borderRadius: 18,
        border: `1.5px solid ${t.borderColor}`,
        background: t.bgGradient,
        boxShadow: `0 2px 8px ${t.glow}, 0 1px 3px rgba(0, 0, 0, 0.02)`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        height: '100%',
      }}
      styles={{ body: { padding: '22px 20px 20px 20px' } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 10px 25px ${t.glow}, 0 4px 10px rgba(0, 0, 0, 0.04)`
        e.currentTarget.style.borderColor = t.borderHover
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 2px 8px ${t.glow}, 0 1px 3px rgba(0, 0, 0, 0.02)`
        e.currentTarget.style.borderColor = t.borderColor
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Top Colorful Accent Gradient Bar */}
      {t.topBar !== 'transparent' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: t.topBar,
          }}
        />
      )}

      {/* Top Row: Title + Pill Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div
          style={{
            color: t.titleColor,
            fontSize: '13.5px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>

        {badgeText && (
          <div
            style={{
              padding: '3px 9px',
              borderRadius: 12,
              background: badgeBg,
              color: badgeColor,
              border: badgeBorder,
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.01em',
            }}
          >
            {badgeText}
          </div>
        )}
      </div>

      {/* Middle Row: Massive Value + Circular Arrow Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div
          style={{
            color: t.valueColor,
            fontWeight: 700,
            fontSize: '28px',
            lineHeight: 1.1,
            letterSpacing: '-0.025em',
            fontFamily: 'Outfit, -apple-system, sans-serif',
          }}
        >
          {prefix && <span style={{ marginRight: 3 }}>{prefix}</span>}
          {value}
          {suffix && (
            <span
              style={{
                fontSize: '19px',
                fontWeight: 600,
                color: t.titleColor,
                opacity: 0.85,
                marginLeft: 3,
              }}
            >
              {suffix}
            </span>
          )}
        </div>

        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: circleBg,
            color: circleColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {trendDirection === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        </div>
      </div>

      {/* Bottom Row: Context Subtitle */}
      {subtitle && (
        <div
          style={{
            color: '#64748b',
            fontSize: '12px',
            fontWeight: 400,
            marginTop: 4,
          }}
        >
          {subtitle}
        </div>
      )}
    </Card>
  )
}

export default KPICard
