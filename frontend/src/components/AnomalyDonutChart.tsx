import React, { useState, useMemo, useCallback } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Typography } from 'antd'

const { Text } = Typography

// ---------------------------------------------------------------------------
// Category data — imported from shared data module
// ---------------------------------------------------------------------------
import { getCategoryInfo } from '../data/anomalyCategories'

// Re-export the interface for consumers
export type { AnomalyCategory } from '../data/anomalyCategories'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnomalyDonutChartProps {
  /** Record of category key -> count */
  distribution: Record<string, number>
  /** Optional total count override (defaults to sum of distribution) */
  totalCount?: number
  /** Size of the chart */
  size?: number
  /** Show legend below */
  showLegend?: boolean
  /** Whether the chart is loading */
  loading?: boolean
  /** Click handler on a category */
  onCategoryClick?: (category: ReturnType<typeof getCategoryInfo>, count: number) => void
  /** Additional class name */
  className?: string
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

interface CustomTooltipData {
  name: string
  rawKey: string
  value: number
}

const CustomTooltip: React.FC<{
  active?: boolean
  payload?: Array<{ payload: CustomTooltipData }>
  total: number
}> = ({ active, payload, total }) => {
  if (!active || !payload || payload.length === 0) return null

  const d = payload[0].payload
  const cat = getCategoryInfo(d.rawKey)
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        minWidth: 160,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: cat.color,
            flexShrink: 0,
            boxShadow: `0 0 6px ${cat.color}40`,
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
          {cat.label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
        <div>
          <strong style={{ color: '#0f172a' }}>{d.value.toLocaleString()}</strong>{' '}
          anomalies
        </div>
        <div>
          <strong>{pct}%</strong> of total
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Segment Label Component (rendered inside the donut center)
// ---------------------------------------------------------------------------

interface CenterLabelProps {
  total: number
  categories: ReturnType<typeof useMemo>
  size: number
}

const CenterLabel: React.FC<CenterLabelProps> = ({ total, categories, size }) => {
  const fontSize = size < 200 ? 20 : size < 300 ? 24 : 30
  const labelSize = size < 200 ? 10 : size < 300 ? 11 : 13

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          color: '#0f172a',
          fontFamily: 'Outfit, -apple-system, sans-serif',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {total.toLocaleString('en-IN')}
      </div>
      <div
        style={{
          fontSize: `${labelSize}px`,
          color: '#64748b',
          fontWeight: 500,
          marginTop: 2,
          letterSpacing: '0.02em',
        }}
      >
        Total Flagged
      </div>
      {categories.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 10,
              background: '#f1f5f9',
              color: '#64748b',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {categories.length} categories
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const AnomalyDonutChart: React.FC<AnomalyDonutChartProps> = ({
  distribution,
  totalCount,
  size = 280,
  showLegend = true,
  loading = false,
  onCategoryClick,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const pieData = useMemo(
    () =>
      Object.entries(distribution || {})
        .filter(([, v]) => (v || 0) > 0)
        .map(([name, value]) => ({
          name: name.replace(/_/g, ' '),
          rawKey: name,
          value: Number(value) || 0,
        }))
        .sort((a, b) => b.value - a.value),
    [distribution]
  )

  const total = totalCount ?? pieData.reduce((acc, item) => acc + item.value, 0)

  const handleMouseEnter = useCallback((_: unknown, index: number) => {
    setHoveredIndex(index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null)
  }, [])

  const handleClick = useCallback(
    (_: unknown, index: number) => {
      if (onCategoryClick && pieData[index]) {
        onCategoryClick(getCategoryInfo(pieData[index].rawKey), pieData[index].value)
      }
    },
    [onCategoryClick, pieData]
  )

  // Donut geometry
  const radius = size < 200 ? 40 : size < 300 ? 55 : 65
  const outerRadius = size < 200 ? 65 : size < 300 ? 85 : 105
  const innerRadius = radius

  if (loading) {
    return (
      <div
        style={{
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(248, 250, 252, 0.5)',
          borderRadius: 20,
          border: '1px dashed #e2e8f0',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #e2e8f0',
              borderTopColor: '#1d4ed8',
              borderRadius: '50%',
              animation: 'prahar-spin 0.8s linear infinite',
              margin: '0 auto 8px',
            }}
          />
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            Loading anomalies...
          </Text>
        </div>
      </div>
    )
  }

  if (pieData.length === 0) {
    return (
      <div
        style={{
          height: size,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(248, 250, 252, 0.5)',
          borderRadius: 20,
          border: '1px dashed #e2e8f0',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </div>
        <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
          No anomalies detected
        </Text>
        <Text style={{ color: '#cbd5e1', fontSize: 11, marginTop: 4 }}>
          All systems clear
        </Text>
      </div>
    )
  }

  const isLarge = size >= 260

  return (
    <div className="anomaly-donut-container" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: showLegend ? 16 : 0 }}>
      {/* ---- Donut Chart ---- */}
      <div style={{ width: '100%', maxWidth: size, height: size, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={hoveredIndex === null ? 3 : 0}
              dataKey="value"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              style={{ cursor: onCategoryClick ? 'pointer' : 'default' }}
            >
              {pieData.map((entry, idx) => {
                const cat = getCategoryInfo(entry.rawKey)
                const isHovered = hoveredIndex === idx

                return (
                  <Cell
                    key={`donut-cell-${entry.rawKey}-${idx}`}
                    fill={`url(#gradient-${entry.rawKey})`}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{
                      transform: `scale(${isHovered ? 1.06 : 1})`,
                      transformOrigin: '50% 50%',
                      opacity: isHovered ? 1 : 0.92,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      filter: isHovered ? `drop-shadow(0 4px 12px ${cat.color}40)` : 'none',
                    }}
                  />
                )
              })}
              <defs>
                {pieData.map((entry) => {
                  const cat = getCategoryInfo(entry.rawKey)
                  return (
                    <linearGradient key={`gradient-${entry.rawKey}`} id={`gradient-${entry.rawKey}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={cat.color} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={cat.color} stopOpacity={0.7} />
                    </linearGradient>
                  )
                })}
              </defs>
            </Pie>
            <Tooltip content={<CustomTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label Overlay */}
        <CenterLabel total={total} categories={pieData} size={size} />
      </div>

      {/* ---- Legend ---- */}
      {showLegend && (
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isLarge ? 180 : 150}px, 1fr))`, gap: 8 }}>
          {pieData.map((item, idx) => {
            const cat = getCategoryInfo(item.rawKey)
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
            const isHovered = hoveredIndex === idx

            return (
              <div
                key={`legend-${item.rawKey}-${idx}`}
                onClick={() => onCategoryClick && handleClick(null, idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: isHovered ? cat.colorLight : '#f8fafc',
                  border: `1px solid ${isHovered ? `${cat.color}30` : '#edf0f2'}`,
                  cursor: onCategoryClick ? 'pointer' : 'default',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  outline: 'none',
                }}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Color dot with icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: cat.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', flexShrink: 0, boxShadow: `0 2px 6px ${cat.color}30`, fontSize: 13, fontWeight: 700,
                }}>
                  {cat.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{pct}%</div>
                </div>

                {/* Count */}
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', fontFamily: 'Outfit, -apple-system, sans-serif', letterSpacing: '-0.01em' }}>
                  {item.value.toLocaleString('en-IN')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AnomalyDonutChart
