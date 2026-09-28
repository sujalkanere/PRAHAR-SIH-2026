import React, { useState } from 'react'
import { Tag, Popover, Switch, Space, Typography } from 'antd'
import {
  RiseOutlined,
  FallOutlined,
  CalculatorOutlined,
  ThunderboltFilled,
  InfoCircleOutlined,
  LineChartOutlined,
  CheckCircleTwoTone,
} from '@ant-design/icons'

const { Text } = Typography

export interface FormulaDetails {
  formulaName: string
  formulaExpression: string
  baselineValue?: string | number
  projectedValue?: string | number
  horizonYears?: number
  annualRatePct?: number
  methodologyNote?: string
  confidenceScore?: number
}

export interface ExpectedGrowthBadgeProps {
  growthPercentage: number
  cagrPercentage?: number
  metricSuffix?: string // e.g. "% 5-Yr Growth" or "% 5-Yr Risk Mitigation"
  singleLineExplanation: string
  formulaDetails?: FormulaDetails
  isRiskReduction?: boolean
  showForecastToggle?: boolean
  forecastActive?: boolean
  onToggleForecast?: (active: boolean) => void
  variant?: 'compact' | 'full' | 'banner'
  style?: React.CSSProperties
}

export const ExpectedGrowthBadge: React.FC<ExpectedGrowthBadgeProps> = ({
  growthPercentage,
  cagrPercentage,
  metricSuffix,
  singleLineExplanation,
  formulaDetails,
  isRiskReduction = false,
  showForecastToggle = false,
  forecastActive = false,
  onToggleForecast,
  variant = 'full',
  style,
}) => {
  const isPositive = growthPercentage >= 0
  const isGood = isRiskReduction ? !isPositive : isPositive

  // Color mapping based on positive growth or good risk reduction
  const accentColor = isRiskReduction
    ? '#0ea5e9' // sky blue for risk containment
    : isGood
    ? '#10b981' // emerald for growth
    : '#f59e0b' // amber warning

  const glowShadow = isRiskReduction
    ? '0 0 14px rgba(14, 165, 233, 0.18)'
    : isGood
    ? '0 0 14px rgba(16, 185, 129, 0.18)'
    : '0 0 14px rgba(245, 158, 11, 0.18)'

  const formattedGrowth = `${isPositive ? '+' : ''}${growthPercentage.toFixed(1)}${metricSuffix || '% (5-Yr Horizon)'}`

  const popoverContent = formulaDetails ? (
    <div style={{ maxWidth: 360, padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <CalculatorOutlined style={{ color: accentColor, fontSize: 16 }} />
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
          {formulaDetails.formulaName}
        </span>
      </div>

      <div
        style={{
          background: 'var(--bg-secondary, #f8fafc)',
          border: '1px solid var(--border-primary, #e2e8f0)',
          borderRadius: 8,
          padding: '8px 12px',
          fontFamily: 'monospace',
          fontSize: 12,
          color: accentColor,
          marginBottom: 10,
        }}
      >
        {formulaDetails.formulaExpression}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, fontSize: 12 }}>
        {formulaDetails.baselineValue !== undefined && (
          <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-surface-elevated, #fff)', border: '1px solid var(--border-secondary, #f1f5f9)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Baseline (T0)</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
              {typeof formulaDetails.baselineValue === 'number'
                ? formulaDetails.baselineValue.toLocaleString('en-IN')
                : formulaDetails.baselineValue}
            </div>
          </div>
        )}

        {formulaDetails.projectedValue !== undefined && (
          <div style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--bg-surface-elevated, #fff)', border: '1px solid var(--border-secondary, #f1f5f9)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>5-Yr Projected (T5)</div>
            <div style={{ fontWeight: 600, color: accentColor, marginTop: 2 }}>
              {typeof formulaDetails.projectedValue === 'number'
                ? formulaDetails.projectedValue.toLocaleString('en-IN')
                : formulaDetails.projectedValue}
            </div>
          </div>
        )}
      </div>

      {formulaDetails.confidenceScore !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-muted)' }}>Statistical Confidence:</span>
          <span style={{ fontWeight: 600, color: '#10b981' }}>
            <CheckCircleTwoTone twoToneColor="#10b981" style={{ marginRight: 4 }} />
            {Math.round(formulaDetails.confidenceScore * 100)}% High Confidence Fit
          </span>
        </div>
      )}

      {formulaDetails.methodologyNote && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-primary, #e2e8f0)', paddingTop: 8, marginTop: 6, lineHeight: 1.4 }}>
          {formulaDetails.methodologyNote}
        </div>
      )}
    </div>
  ) : null

  if (variant === 'compact') {
    return (
      <Popover content={popoverContent} title={null} trigger="hover">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 10px',
            borderRadius: 20,
            background: 'var(--bg-surface-elevated, #ffffff)',
            border: `1px solid ${accentColor}40`,
            boxShadow: glowShadow,
            cursor: 'help',
            fontSize: 12,
            ...style,
          }}
        >
          {isPositive ? (
            <RiseOutlined style={{ color: accentColor }} />
          ) : (
            <FallOutlined style={{ color: accentColor }} />
          )}
          <span style={{ fontWeight: 700, color: accentColor }}>{formattedGrowth}</span>
          {cagrPercentage !== undefined && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border-primary)', paddingLeft: 6 }}>
              CAGR: {cagrPercentage > 0 ? `+${cagrPercentage}%` : `${cagrPercentage}%`}
            </span>
          )}
        </div>
      </Popover>
    )
  }

  // Full / Banner Variant
  return (
    <div
      style={{
        background: 'var(--bg-surface-elevated, #ffffff)',
        border: `1px solid var(--border-primary, #e2e8f0)`,
        borderRadius: 12,
        padding: '10px 14px',
        boxShadow: glowShadow,
        marginBottom: 12,
        transition: 'all 0.25s ease',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        {/* Left: Pill with growth & CAGR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Popover content={popoverContent} trigger="hover" placement="bottomLeft">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 16,
                background: `${accentColor}12`,
                border: `1px solid ${accentColor}50`,
                cursor: 'pointer',
              }}
            >
              <ThunderboltFilled style={{ color: accentColor, fontSize: 13 }} />
              <span style={{ fontWeight: 700, fontSize: 12.5, color: accentColor, letterSpacing: '-0.2px' }}>
                {formattedGrowth}
              </span>
              {cagrPercentage !== undefined && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    borderLeft: `1px solid ${accentColor}40`,
                    paddingLeft: 6,
                  }}
                >
                  CAGR: {cagrPercentage > 0 ? `+${cagrPercentage}%` : `${cagrPercentage}%`}/yr
                </span>
              )}
              <InfoCircleOutlined style={{ fontSize: 11, color: accentColor, opacity: 0.8 }} />
            </div>
          </Popover>

          {/* Single-line explanation */}
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary, #334155)',
              fontWeight: 500,
              lineHeight: 1.4,
              flex: '1 1 260px',
            }}
          >
            {singleLineExplanation}
          </span>
        </div>

        {/* Right: Optional Interactive Forecast Horizon Toggle */}
        {showForecastToggle && onToggleForecast && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 8px',
              borderRadius: 8,
              background: 'var(--bg-secondary, #f8fafc)',
              border: '1px solid var(--border-secondary, #f1f5f9)',
            }}
          >
            <LineChartOutlined style={{ color: forecastActive ? accentColor : 'var(--text-muted)', fontSize: 13 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
              5-Yr Forecast Projection
            </span>
            <Switch
              size="small"
              checked={forecastActive}
              onChange={onToggleForecast}
              style={{
                background: forecastActive ? accentColor : undefined,
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ExpectedGrowthBadge
