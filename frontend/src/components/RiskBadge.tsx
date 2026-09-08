import React from 'react'
import { Tag } from 'antd'
import { RiskTier, AnomalySeverity } from '../types'

interface RiskBadgeProps {
  tier?: RiskTier | AnomalySeverity | string | null
  score?: number | null
  showScore?: boolean
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ tier, score, showScore = false }) => {
  const normalizedTier = (tier || 'LOW').toUpperCase()

  let color = '#15803d'
  let bg = '#f0fdf4'
  let border = '#bbf7d0'

  switch (normalizedTier) {
    case 'CRITICAL':
      color = '#b91c1c'
      bg = '#fef2f2'
      border = '#fecaca'
      break
    case 'HIGH':
      color = '#c2410c'
      bg = '#fff7ed'
      border = '#fed7aa'
      break
    case 'MEDIUM':
      color = '#b45309'
      bg = '#fffbeb'
      border = '#fde68a'
      break
    case 'LOW':
    default:
      color = '#15803d'
      bg = '#f0fdf4'
      border = '#bbf7d0'
      break
  }

  return (
    <Tag
      style={{
        color,
        backgroundColor: bg,
        borderColor: border,
        fontWeight: 700,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: '11px',
        letterSpacing: '0.04em',
      }}
    >
      {normalizedTier}
      {showScore && score !== undefined && score !== null ? ` (${score})` : ''}
    </Tag>
  )
}

export default RiskBadge
