import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Table, Space, Tag, Spin, Button, Empty } from 'antd'
import {
  ProjectOutlined,
  DollarOutlined,
  WarningOutlined,
  AlertOutlined,
  ArrowRightOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
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
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import { NationalSummaryData } from '../types'
import { KPICard } from '../components/KPICard'
import { IndiaMap } from '../components/IndiaMap'
import { RiskBadge } from '../components/RiskBadge'
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
  const [data, setData] = useState<NationalSummaryData | null>(null)
  const [loading, setLoading] = useState(true)

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
        <Spin size="large" tip="Loading National Sentinel Dashboard..." />
      </div>
    )
  }

  // Format KPIs safely with all backend key aliases
  const totalWorks =
    data.kpis?.find((k) => k.key === 'total_works' || k.key === 'works')?.value ?? 0
  const totalExp =
    Number(data.kpis?.find((k) => k.key === 'total_expenditure' || k.key === 'total_expenditure_cr' || k.key === 'expenditure')?.value ?? 0)
  const highRiskConsts =
    data.kpis?.find((k) => k.key === 'high_risk_constituencies' || k.key === 'high_risk')?.value ??
    (data.top_risky_constituencies || []).filter((c) => (c.risk_score || 0) >= 50).length
  const activeAnomalies =
    data.kpis?.find((k) => k.key === 'anomalies_detected' || k.key === 'active_anomalies' || k.key === 'anomalies')?.value ?? 0

  // Category donut data
  const pieData = Object.entries(data.anomaly_distribution || {}).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    rawKey: name,
    value,
  }))

  const totalAnomaliesCount = pieData.reduce((acc, item) => acc + (Number(item.value) || 0), 0)

  // Top 10 bar chart data
  const barData = (data.top_risky_constituencies || []).slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    risk: c.risk_score,
    tier: c.risk_tier,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            National Risk & Anomaly Overview
          </Title>
          <Text style={{ color: '#475569', fontSize: '13px' }}>
            Multi-detector intelligence console across 543 Parliamentary Constituencies
          </Text>
        </div>
        <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
          MPLADS ACTIVE
        </Tag>
      </div>

      {/* 4 KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Sanctioned Works"
            value={totalWorks}
            prefix={<ProjectOutlined />}
            color="#1d4ed8"
            subtitle="Analyzed across all official datasets"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Expenditure"
            value={totalExp.toFixed(2)}
            suffix=" Cr"
            prefix={<DollarOutlined />}
            color="#15803d"
            subtitle="Actual cumulative outlay tracked"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="High-Risk Constituencies"
            value={highRiskConsts}
            prefix={<WarningOutlined />}
            color="#c2410c"
            subtitle="Composite score >= 50 threshold"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Active Anomalies"
            value={activeAnomalies}
            prefix={<AlertOutlined />}
            color="#b91c1c"
            subtitle="Flagged by Target 6-Risk Engine"
            onClick={() => navigate('/alerts')}
          />
        </Col>
      </Row>

      {/* Map & Top-10 Bar Chart */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>India Risk Choropleth Map</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>Click state to view breakdown</span>
              </div>
            }
            styles={{ body: { padding: 12 } }}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <IndiaMap
              stateSummaries={data.state_summaries || []}
              onSelectState={(stateName) => navigate(`/state?state=${encodeURIComponent(stateName)}`)}
            />
          </Card>
        </Col>

        <Col xs={24} lg={11}>
          <Card
            title="Top-10 Highest Risk Constituencies"
            styles={{ body: { padding: '20px 12px 12px 12px' } }}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <div style={{ height: 500, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 70, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="#475569" tick={{ fill: '#475569', fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#475569"
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                    width={90}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: 8,
                      color: '#0f172a',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(val: any, _name: any, props: any) => [
                      `${val} / 100 (${props.payload.tier})`,
                      'Risk Score',
                    ]}
                  />
                  <Bar
                    dataKey="risk"
                    radius={[0, 4, 4, 0]}
                    onClick={(entry) => {
                      if (entry && entry.id) {
                        navigate(`/constituency/${entry.id}`)
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {barData.map((entry, index) => {
                      let color = '#22c55e'
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

      {/* Distribution Charts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Anomalies by Detection Category</span>
                <Tag color="blue">{totalAnomaliesCount} Total</Tag>
              </div>
            }
            styles={{ body: { padding: 20 } }}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <div style={{ height: 320, width: '100%' }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CATEGORY_COLORS[entry.rawKey] || '#475569'}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: 8,
                        color: '#0f172a',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span style={{ color: '#475569', fontSize: '11px' }}>{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No anomalies currently flagged" />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card
            title="Anomaly Trends by Financial Year"
            styles={{ body: { padding: 20 } }}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <div style={{ height: 320, width: '100%' }}>
              {data.trends && data.trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trends} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="financial_year" stroke="#475569" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 12 }} />
                    <RechartsTooltip
                      contentStyle={{
                        background: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: 8,
                        color: '#0f172a',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span style={{ color: '#475569', fontSize: '12px' }}>{val}</span>}
                    />
                    <Line type="monotone" dataKey="COST_OVERRUN" name="Cost Overrun" stroke="#b91c1c" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="DELAYED_PROJECT" name="Delay" stroke="#c2410c" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="DUPLICATE_WORK" name="Duplicate" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="PATTERN_ANOMALY" name="Pattern" stroke="#b45309" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="FUND_MISUTILIZATION" name="Utilization" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Empty description="No multi-year trend data recorded yet" />
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Alerts Feed */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Priority Anomaly Detections Feed</span>
            <Button
              type="link"
              onClick={() => navigate('/alerts')}
              style={{ color: '#1d4ed8', padding: 0, fontWeight: 600 }}
            >
              View Full Alert Queue <ArrowRightOutlined />
            </Button>
          </div>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
      >
        <Table
          dataSource={data.recent_alerts || []}
          rowKey="id"
          pagination={false}
          size="middle"
          columns={[
            {
              title: 'Work Ref / Description',
              dataIndex: 'work_ref',
              render: (_: any, record: any) => (
                <div
                  style={{ cursor: record.work_id ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (record.work_id) {
                      setSelectedWorkId(record.work_id)
                      setSelectedWorkRef(record.work_ref)
                      setDrawerOpen(true)
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1d4ed8' }}>
                    {record.work_ref || 'Constituency Level'}
                  </div>
                  <Text style={{ color: '#475569', fontSize: '12px' }}>
                    {record.details?.work_description || record.details?.reason || record.anomaly_type}
                  </Text>
                </div>
              ),
            },
            {
              title: 'Constituency',
              dataIndex: 'constituency_name',
              render: (val: string, record: any) => (
                <span>
                  <strong>{val || 'N/A'}</strong> <Text style={{ color: '#475569', fontSize: '11px' }}>({record.state})</Text>
                </span>
              ),
            },
            {
              title: 'Severity',
              dataIndex: 'severity',
              render: (val: string) => <RiskBadge tier={val} />,
            },
            {
              title: 'Confidence',
              dataIndex: 'confidence_score',
              render: (val: number) => (
                <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{Math.round(val * 100)}%</span>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (val: string) => (
                <Tag color={val === 'NEW' ? 'volcano' : val === 'RESOLVED' ? 'green' : 'gold'}>
                  {val}
                </Tag>
              ),
            },
            {
              title: 'Investigation',
              render: (_: any, record: any) => (
                <Button
                  size="small"
                  type="default"
                  icon={<FileSearchOutlined />}
                  onClick={() => {
                    if (record.work_id) {
                      setSelectedWorkId(record.work_id)
                      setSelectedWorkRef(record.work_ref)
                      setDrawerOpen(true)
                    }
                  }}
                >
                  Inspect
                </Button>
              ),
            },
          ]}
        />
      </Card>

      {/* Investigation Drawer */}
      <InvestigationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workId={selectedWorkId}
        workRef={selectedWorkRef}
        onStatusChange={loadData}
      />
    </div>
  )
}

export default NationalDashboardPage
