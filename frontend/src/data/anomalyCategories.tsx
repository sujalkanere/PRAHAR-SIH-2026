import { ReactNode } from 'react'
import {
  FireOutlined,
  RocketOutlined,
  BlockOutlined,
  ExperimentOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  AlertOutlined,
  BuildOutlined,
  ThunderboltOutlined,
  PieChartOutlined,
} from '@ant-design/icons'

export interface AnomalyCategory {
  key: string
  label: string
  icon: ReactNode
  gradient: string
  color: string
  colorLight: string
}

export const ANOMALY_CATEGORIES: AnomalyCategory[] = [
  {
    key: 'COST_OVERRUN',
    label: 'Cost Overrun',
    icon: <FireOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #dc2626, #f87171)',
    color: '#dc2626',
    colorLight: 'rgba(220, 38, 38, 0.08)',
  },
  {
    key: 'DELAYED_PROJECT',
    label: 'Delayed/Stalled',
    icon: <RocketOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #ea580c, #fb923c)',
    color: '#ea580c',
    colorLight: 'rgba(234, 88, 12, 0.08)',
  },
  {
    key: 'DUPLICATE_WORK',
    label: 'Duplicate Work',
    icon: <BlockOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
    color: '#7c3aed',
    colorLight: 'rgba(124, 58, 237, 0.08)',
  },
  {
    key: 'PATTERN_ANOMALY',
    label: 'Pattern Anomaly',
    icon: <ExperimentOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #d97706, #fbbf24)',
    color: '#d97706',
    colorLight: 'rgba(217, 119, 6, 0.08)',
  },
  {
    key: 'FUND_MISUTILIZATION',
    label: 'Fund Misutilization',
    icon: <DollarOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #1d4ed8, #60a5fa)',
    color: '#1d4ed8',
    colorLight: 'rgba(29, 78, 216, 0.08)',
  },
  {
    key: 'PAYMENT_RISK',
    label: 'Payment Risk',
    icon: <SafetyCertificateOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #0284c7, #38bdf8)',
    color: '#0284c7',
    colorLight: 'rgba(2, 132, 199, 0.08)',
  },
  {
    key: 'COMPLIANCE_RISK',
    label: 'Compliance Risk',
    icon: <AlertOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
    color: '#0d9488',
    colorLight: 'rgba(13, 148, 136, 0.08)',
  },
  {
    key: 'DURABILITY_RISK',
    label: 'Durability Risk',
    icon: <BuildOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #4f46e5, #818cf8)',
    color: '#4f46e5',
    colorLight: 'rgba(79, 70, 229, 0.08)',
  },
  {
    key: 'STALLED_PROJECT',
    label: 'Stalled Project',
    icon: <ThunderboltOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #c2410c, #ea580c)',
    color: '#c2410c',
    colorLight: 'rgba(194, 65, 12, 0.08)',
  },
]

const categoryMap = new Map(ANOMALY_CATEGORIES.map((c) => [c.key, c]))

export const getCategoryInfo = (key: string): AnomalyCategory => {
  return categoryMap.get(key) || {
    key,
    label: key.replace(/_/g, ' '),
    icon: <PieChartOutlined style={{ fontSize: 14 }} />,
    gradient: 'linear-gradient(135deg, #64748b, #94a3b8)',
    color: '#64748b',
    colorLight: 'rgba(100, 116, 139, 0.08)',
  }
}
