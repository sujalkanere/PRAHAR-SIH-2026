import React from 'react'
import { Card, Typography, Tooltip, Progress } from 'antd'

const { Text, Title } = Typography

export interface CircularRiskScoreProps {
  score: number
  tier?: string
  projectTitle?: string
  description?: string
  location?: string
  infoText?: string
  showComponents?: boolean
  components?: {
    cost_overrun?: number
    delay?: number
    duplicate?: number
    pattern?: number
    fund_utilization?: number
  }
  style?: React.CSSProperties
  className?: string
}

export const CircularRiskScore: React.FC<CircularRiskScoreProps> = ({
  score = 87,
  tier,
  projectTitle = 'Project: MP-27',
  description = 'Rural Road Construction',
  location = 'XYZ, Maharashtra',
  infoText = 'Higher the score, higher the likelihood of irregularities. Each project gets a transparent 0–100 risk score with clear reasons.',
  showComponents = false,
  components,
  style,
  className,
}) => {
  // Determine effective tier from score if not provided
  const effectiveTier = (
    tier || (score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW')
  ).toUpperCase()

  // Badge and ring accent colors matching the reference style
  let accentColor = '#E5252A' // Crimson Red
  let badgeText = 'HIGH RISK'

  if (effectiveTier === 'CRITICAL') {
    accentColor = '#DC2626'
    badgeText = 'CRITICAL RISK'
  } else if (effectiveTier === 'HIGH') {
    accentColor = '#E5252A'
    badgeText = 'HIGH RISK'
  } else if (effectiveTier === 'MEDIUM') {
    accentColor = '#D97706'
    badgeText = 'MEDIUM RISK'
  } else {
    accentColor = '#16A34A'
    badgeText = 'LOW RISK'
  }

  // Geometry for SVG Gauge (viewBox: 0 0 220 220, center 110, 110)
  const cx = 110
  const cy = 110
  const r = 86
  const strokeWidth = 16

  // Helper to convert polar to cartesian coordinates
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    }
  }

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle)
    const end = polarToCartesian(x, y, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
    return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
  }

  // Segment 1: Dark Navy Blue (#0F2942) representing foundation (bottom & left arc)
  const pathNavy = describeArc(cx, cy, r, 95, 290)
  // Segment 2: Slate Steel Blue (#2B6CB0) transition arc (upper left)
  const pathBlue = describeArc(cx, cy, r, 290, 360)
  // Segment 3: Accent / Alert Arc (upper right, from 0 to 95 degrees)
  const pathAccent = describeArc(cx, cy, r, 0, 95)

  return (
    <Card
      className={className}
      style={{
        borderRadius: 20,
        border: '1px solid #E2E8F0',
        background: '#FFFFFF',
        boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
        padding: '24px 20px',
        maxWidth: 380,
        margin: '0 auto',
        ...style,
      }}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Circular Gauge Ring Container */}
        <div style={{ position: 'relative', width: 220, height: 220 }}>
          <svg width={220} height={220} viewBox="0 0 220 220" style={{ transform: 'rotate(0deg)' }}>
            {/* Subtle inner concentric guide ring */}
            <circle
              cx={cx}
              cy={cy}
              r={r - strokeWidth / 2 - 3}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth={1}
            />

            {/* Arc 1: Deep Navy */}
            <path
              d={pathNavy}
              fill="none"
              stroke="#0A2540"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />

            {/* Arc 2: Steel Blue */}
            <path
              d={pathBlue}
              fill="none"
              stroke="#2B6CB0"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />

            {/* Arc 3: Risk Alert (Red/Accent) */}
            <path
              d={pathAccent}
              fill="none"
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />
          </svg>

          {/* Central Typography and Risk Pill */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {/* 87/100 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                color: '#0A2540',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-1.5px' }}>
                {score}
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, opacity: 0.9, marginLeft: 2 }}>
                /100
              </span>
            </div>

            {/* HIGH RISK Pill Badge */}
            <div
              style={{
                backgroundColor: accentColor,
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 800,
                letterSpacing: 0.8,
                padding: '4px 16px',
                borderRadius: 6,
                textTransform: 'uppercase',
                boxShadow: `0 2px 8px ${accentColor}40`,
                fontFamily: "'Outfit', 'Inter', sans-serif",
              }}
            >
              {badgeText}
            </div>
          </div>
        </div>

        {/* Project Details Section */}
        <div style={{ textAlign: 'center', marginTop: 14, width: '100%' }}>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: '#0A2540',
              fontFamily: "'Outfit', sans-serif",
              letterSpacing: '-0.3px',
            }}
          >
            {projectTitle}
          </div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: '#1E293B',
              marginTop: 4,
              lineHeight: 1.35,
              maxWidth: 320,
              margin: '4px auto 0',
            }}
          >
            {description}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#64748B',
              marginTop: 3,
            }}
          >
            {location}
          </div>
        </div>

        {/* Optional Risk Components Breakdown */}
        {showComponents && components && (
          <div
            style={{
              width: '100%',
              marginTop: 16,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8, textTransform: 'uppercase' }}>
              Risk Factor Breakdown
            </div>
            {Object.entries(components).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>
                  {key.replace('_', ' ')}
                </span>
                <div style={{ width: '55%', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress
                    percent={val}
                    size="small"
                    strokeColor={val >= 70 ? '#EF4444' : val >= 40 ? '#F59E0B' : '#10B981'}
                    showInfo={false}
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, width: 26, textAlign: 'right', color: '#1E293B' }}>
                    {val}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Informational Callout Card */}
        <div
          style={{
            marginTop: 18,
            width: '100%',
            backgroundColor: '#EEF6FC',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid #E2E8F0',
          }}
        >
          {/* Left Vertical Accent Stripe */}
          <div
            style={{
              width: 4,
              minWidth: 4,
              height: 38,
              borderRadius: 4,
              backgroundColor: '#0A2540',
            }}
          />
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.45,
              color: '#27496D',
              fontWeight: 500,
            }}
          >
            {infoText}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default CircularRiskScore
