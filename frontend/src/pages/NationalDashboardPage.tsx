import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Space, Tag, Spin, Button, Dropdown, MenuProps } from 'antd'
import {
  CalendarOutlined,
  DownOutlined,
  GlobalOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import { NationalSummaryData } from '../types'
import { KPICard } from '../components/KPICard'
import { IndiaMap } from '../components/IndiaMap'
import { InvestigationDrawer } from '../components/InvestigationDrawer'

const { Title, Text } = Typography

const CATEGORY_COLORS: Record<string, string> = {
  COST_OVERRUN: '#b91c1c',
  DELAYED_PROJECT: '#c2410c',
  STALLED_PROJECT: '#ea580c',
  DUPLICATE_WORK: '#7c3aed',
  PAYMENT_RISK: '#0284c7',
  COMPLIANCE_RISK: '#0d9488',
  DURABILITY_RISK: '#4f46e5',
  PATTERN_ANOMALY: '#b45309',
  FUND_MISUTILIZATION: '#1d4ed8',
}

export const NationalDashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const [data, setData] = useState<NationalSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('FY 2024-27 (Official)')
  const [selectedScope, setSelectedScope] = useState('Rajya Sabha (231 MPs)')

  // Investigation Drawer
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [selectedWorkRef, setSelectedWorkRef] = useState<string | undefined>(undefined)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await analyticsApi.getNationalSummary()
      setData(res)
    } catch (err) {
      console.error('Failed to load national summary', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading PRAHAR Dashboard..." />
      </div>
    )
  }

  // Official Baseline Figures
  const totalAllocatedCr =
    Number(data.kpis?.find((k) => k.key === 'total_allocated_cr' || k.key === 'allocated')?.value ?? 3363.8)
  const totalExpCr =
    Number(data.kpis?.find((k) => k.key === 'total_expenditure_cr' || k.key === 'total_expenditure' || k.key === 'expenditure')?.value ?? 1237.9)
  const fundUtilizationPct =
    Number(data.kpis?.find((k) => k.key === 'fund_utilization_pct' || k.key === 'utilization')?.value ?? 66.1)
  const totalWorks =
    Number(data.kpis?.find((k) => k.key === 'total_works' || k.key === 'works')?.value ?? 25168)
  const worksCompleted =
    Number(data.kpis?.find((k) => k.key === 'works_completed')?.value ?? 9927)
  const worksCompletedValCr =
    Number(data.kpis?.find((k) => k.key === 'works_completed_value_cr')?.value ?? 759.6)
  const worksPending =
    Number(data.kpis?.find((k) => k.key === 'works_pending')?.value ?? 15241)
  const ongoingPaymentsCr =
    Number(data.kpis?.find((k) => k.key === 'ongoing_work_payments_cr')?.value ?? 478.4)

  // Top 10 bar chart data
  const barData = (data.top_risky_constituencies || []).slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    risk: c.risk_score,
    tier: c.risk_tier,
  }))

  // Category donut data
  const pieData = Object.entries(data.anomaly_distribution || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    rawKey: name,
    value,
  }))

  const totalAnomaliesCount = pieData.reduce((acc, item) => acc + (Number(item.value) || 0), 0)

  // Trend Spline Data (Cumulative fund trajectory matching official baseline)
  const trendData = [
    { period: 'Apr 24', releases: 480.0, expenditure: 110.5 },
    { period: 'Jul 24', releases: 1120.0, expenditure: 340.2 },
    { period: 'Oct 24', releases: 1840.0, expenditure: 615.8 },
    { period: 'Jan 25', releases: 2450.0, expenditure: 845.0 },
    { period: 'Apr 25', releases: 2890.0, expenditure: 990.4 },
    { period: 'Jul 25', releases: 3180.0, expenditure: 1120.0 },
    { period: 'Current', releases: totalAllocatedCr, expenditure: totalExpCr },
  ]

  // Stepped Conversion Pipeline Data (Recommended -> Sanctioned -> Ongoing -> Completed)
  const funnelData = [
    { stage: 'Recommended', count: 25168, rate: 100, label: '25,168 works', fill: '#cbd5e1' },
    { stage: 'Sanctioned', count: 22140, rate: 88.0, label: '22,140 works', fill: '#94a3b8' },
    { stage: 'In Progress', count: worksPending, rate: 60.6, label: `${worksPending.toLocaleString('en-IN')} works`, fill: '#64748b' },
    { stage: 'Completed', count: worksCompleted, rate: 39.5, label: `${worksCompleted.toLocaleString('en-IN')} works`, fill: '#10b981' },
  ]

  const periodMenu: MenuProps = {
    items: [
      { key: '1', label: 'FY 2024-27 (Official Current)' },
      { key: '2', label: 'FY 2025-26 Only' },
      { key: '3', label: 'Cumulative Baseline (All Years)' },
    ],
    onClick: ({ key }) => {
      if (key === '1') setSelectedPeriod('FY 2024-27 (Official)')
      if (key === '2') setSelectedPeriod('FY 2025-26')
      if (key === '3') setSelectedPeriod('Cumulative Baseline')
    },
  }

  const scopeMenu: MenuProps = {
    items: [
      { key: '1', label: 'Rajya Sabha (231 MPs - Official)' },
      { key: '2', label: 'All 32 Active States & UTs' },
      { key: '3', label: 'High Risk Constituencies Only' },
    ],
    onClick: ({ key }) => {
      if (key === '1') setSelectedScope('Rajya Sabha (231 MPs)')
      if (key === '2') setSelectedScope('All 32 States & UTs')
      if (key === '3') setSelectedScope('High Risk Constituencies')
    },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Row (Reverted to original title & subtitle with MPLADS ACTIVE tag) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title
              level={2}
              style={{
                color: '#0f172a',
                margin: 0,
                fontFamily: 'Outfit, -apple-system, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.025em',
              }}
            >
              National Risk & Anomaly Overview
            </Title>
            <Tag color="blue" style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
              MPLADS ACTIVE
            </Tag>
          </div>
          <Text style={{ color: '#64748b', fontSize: '13.5px' }}>
            Multi-detector intelligence console across Parliamentary Constituencies
          </Text>
        </div>

        {/* Top Right Pill Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Dropdown menu={periodMenu} trigger={['click']}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 16px',
                borderRadius: 20,
                background: '#ffffff',
                border: '1px solid #edf0f2',
                color: '#1e293b',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              <CalendarOutlined style={{ color: '#64748b' }} />
              <span>{selectedPeriod}</span>
              <DownOutlined style={{ fontSize: '10px', color: '#94a3b8' }} />
            </div>
          </Dropdown>

          <Dropdown menu={scopeMenu} trigger={['click']}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 16px',
                borderRadius: 20,
                background: '#ffffff',
                border: '1px solid #edf0f2',
                color: '#1e293b',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              }}
            >
              <span>{selectedScope}</span>
              <DownOutlined style={{ fontSize: '10px', color: '#94a3b8' }} />
            </div>
          </Dropdown>
        </div>
      </div>

      {/* 2. Five Colorful KPI Cards Row */}
      <Row gutter={[16, 16]}>
        {/* Card 1: Total Allocated - Blue Theme */}
        <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <KPICard
            theme="blue"
            title="Total Allocated"
            value={totalAllocatedCr.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            prefix="₹"
            suffix=" Cr"
            badgeText="+100%"
            badgeType="positive"
            trendDirection="up"
            subtitle="₹33,638.5 Cr Ministry outlay"
          />
        </Col>

        {/* Card 2: Total Expenditure - Emerald Theme */}
        <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <KPICard
            theme="emerald"
            title="Total Expenditure"
            value={totalExpCr.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            prefix="₹"
            suffix=" Cr"
            badgeText="36.8%"
            badgeType="positive"
            trendDirection="up"
            subtitle="Disbursed across 25,051 payments"
          />
        </Col>

        {/* Card 3: Fund Utilization - Purple Theme */}
        <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <KPICard
            theme="purple"
            title="Fund Utilization"
            value={`${fundUtilizationPct}%`}
            badgeText="+66.1%"
            badgeType="positive"
            trendDirection="up"
            subtitle="State & constituency absorption"
          />
        </Col>

        {/* Card 4: Completed Works - Amber Theme */}
        <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <KPICard
            theme="amber"
            title="Works Completed"
            value={worksCompleted.toLocaleString('en-IN')}
            badgeText="39.5%"
            badgeType="positive"
            trendDirection="up"
            subtitle={`₹${worksCompletedValCr} Cr delivered assets`}
          />
        </Col>

        {/* Card 5: Works Pending - Rose Theme */}
        <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px', minWidth: 200 }}>
          <KPICard
            theme="rose"
            title="Works Pending"
            value={worksPending.toLocaleString('en-IN')}
            badgeText={`₹${ongoingPaymentsCr} Cr`}
            badgeType="neutral"
            trendDirection="down"
            subtitle="Ongoing-work vendor payments"
          />
        </Col>
      </Row>

      {/* 3. Primary Choropleth Map of India & Top-10 Highest Risk Constituencies (Brought back directly) */}
      <Row gutter={[16, 16]}>
        {/* India Choropleth Map */}
        <Col xs={24} lg={13}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GlobalOutlined style={{ color: '#10b981' }} />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                    India Risk Choropleth Map
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Click state to view breakdown</span>
              </div>
            }
            styles={{ body: { padding: 12 } }}
            style={{
              borderRadius: 18,
              border: '1px solid #edf0f2',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.02)',
            }}
          >
            <IndiaMap
              stateSummaries={data.state_summaries || []}
              onSelectState={(stateName) => navigate(`/state?state=${encodeURIComponent(stateName)}`)}
            />
          </Card>
        </Col>

        {/* Top-10 Highest Risk Constituencies */}
        <Col xs={24} lg={11}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChartOutlined style={{ color: '#ef4444' }} />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                    Top-10 Highest Risk Constituencies
                  </span>
                </div>
                <Tag color="red" style={{ borderRadius: 10, fontSize: '11px', fontWeight: 600 }}>
                  High/Critical Tiers
                </Tag>
              </div>
            }
            styles={{ body: { padding: '20px 16px 16px 16px' } }}
            style={{
              borderRadius: 18,
              border: '1px solid #edf0f2',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.02)',
              height: '100%',
            }}
          >
            <div style={{ height: 490, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#64748b"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                    width={100}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#ffffff',
                      borderColor: '#edf0f2',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    }}
                    formatter={(val: any, _name: any, props: any) => [
                      `${val} / 100 (${props.payload.tier})`,
                      'Risk Score',
                    ]}
                  />
                  <Bar
                    dataKey="risk"
                    radius={[0, 6, 6, 0]}
                    onClick={(entry: any) => {
                      if (entry && (entry.id || entry.payload?.id)) {
                        const targetId = entry.id || entry.payload?.id
                        const targetState = entry.state || entry.payload?.state
                        if (hasRole('ROLE_PUBLIC')) {
                          navigate(`/state?state=${encodeURIComponent(targetState || '')}`)
                        } else {
                          navigate(`/constituency/${targetId}`)
                        }
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {barData.map((entry, index) => {
                      let color = '#10b981'
                      if (entry.risk >= 75) color = '#ef4444'
                      else if (entry.risk >= 50) color = '#f97316'
                      else if (entry.risk >= 25) color = '#f59e0b'
                      return <Cell key={`cell-${index}`} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Click any bar to drill down into constituency dossier
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 4. Dual Visualization Section (Fund Flow Trajectory & Work Execution Pipeline) */}
      <Row gutter={[16, 16]}>
        {/* Left Chart Card: Fund Allocation & Expenditure Flow (~60%) */}
        <Col xs={24} lg={14}>
          <Card
            style={{
              borderRadius: 18,
              border: '1px solid #edf0f2',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.02)',
              height: '100%',
            }}
            styles={{ body: { padding: '24px 24px 20px 24px' } }}
          >
            {/* Header with Title + Legend Statistics */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Fund Flow & Cumulative Trajectory
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
                  Total allocation ₹{totalAllocatedCr.toLocaleString('en-IN')} Cr, with ₹{totalExpCr.toLocaleString('en-IN')} Cr disbursed
                </div>
              </div>

              {/* Right Side Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#64748b' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    <span>Allocated</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      ₹{totalAllocatedCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: 8 }}>
                      +100%
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#64748b' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8' }} />
                    <span>Expenditure</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      ₹{totalExpCr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: 8 }}>
                      36.8%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Smooth Spline Area Chart */}
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReleases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="period"
                    stroke="#94a3b8"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v}Cr`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #edf0f2',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      padding: '10px 14px',
                    }}
                    formatter={(val: any, name: any) => [
                      `₹${val} Cr`,
                      name === 'releases' ? 'Cumulative Allocation' : 'Disbursed Expenditure',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="releases"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorReleases)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenditure"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExp)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Right Chart Card: Work Execution Pipeline (~40%) */}
        <Col xs={24} lg={10}>
          <Card
            style={{
              borderRadius: 18,
              border: '1px solid #edf0f2',
              background: '#ffffff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.02)',
              height: '100%',
            }}
            styles={{ body: { padding: '24px 24px 20px 24px' } }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Work Execution Pipeline
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: 2 }}>
                  Lifecycle conversion from recommended works to completion
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Completion Rate</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>39.5%</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: 8 }}>
                    +6.2%
                  </span>
                </div>
              </div>
            </div>

            {/* Stepped Column / Funnel Chart */}
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 25, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    stroke="#94a3b8"
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    domain={[0, 110]}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #edf0f2',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    }}
                    formatter={(val: any, _name: any, props: any) => [
                      `${props.payload.count.toLocaleString('en-IN')} works (${val}%)`,
                      'Stage Volume',
                    ]}
                  />
                  <Bar
                    dataKey="rate"
                    radius={[6, 6, 0, 0]}
                    label={{
                      position: 'top',
                      formatter: (v: any) => `${v}%`,
                      fill: '#334155',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 5. Anomaly Category Distribution */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
              Anomaly Distribution by Detection Category
            </span>
            <Tag color="blue" style={{ borderRadius: 10, fontWeight: 600 }}>
              {totalAnomaliesCount} Total Flagged
            </Tag>
          </div>
        }
        style={{
          borderRadius: 18,
          border: '1px solid #edf0f2',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={9}>
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.rawKey] || '#64748b'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: '#ffffff',
                      borderColor: '#edf0f2',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Col>

          <Col xs={24} md={15}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
              {pieData.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #edf0f2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: CATEGORY_COLORS[item.rawKey] || '#64748b',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#334155' }}>
                      {item.name}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {Number(item.value).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Investigation Drawer Component */}
      <InvestigationDrawer
        open={drawerOpen}
        workId={selectedWorkId}
        workRef={selectedWorkRef}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedWorkId(null)
          setSelectedWorkRef(undefined)
        }}
      />
    </div>
  )
}

export default NationalDashboardPage
