import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Table,
  Space,
  Tag,
  Spin,
  Tabs,
  Input,
  Select,
  Button,
  Segmented,
} from 'antd'
import {
  DollarOutlined,
  WarningOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { constituenciesApi } from '../api/constituencies'
import { worksApi, WorkListParams } from '../api/works'
import { ConstituencyDetailData, Work } from '../types'
import { KPICard } from '../components/KPICard'
import { RiskBadge } from '../components/RiskBadge'
import { InvestigationDrawer } from '../components/InvestigationDrawer'
import { DuplicatePairsCard } from '../components/DuplicatePairsCard'

const { Title, Text } = Typography

export const ConstituencyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<ConstituencyDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFy, setSelectedFy] = useState<string>('2024-25')

  // Works state
  const [works, setWorks] = useState<Work[]>([])
  const [totalWorks, setTotalWorks] = useState(0)
  const [worksLoading, setWorksLoading] = useState(false)
  const [workParams, setWorkParams] = useState<WorkListParams>({
    page: 1,
    per_page: 10,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)

  // Selected work for investigation drawer
  const [selectedWork, setSelectedWork] = useState<Work | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [chartType, setChartType] = useState<'bar' | 'donut'>('bar')

  useEffect(() => {
    if (id) {
      loadConstituencyDetail(id, selectedFy)
    }
  }, [id, selectedFy])

  useEffect(() => {
    if (id) {
      loadWorks()
    }
  }, [id, workParams, searchQuery, selectedCategory, selectedStatus, selectedFy])

  const loadConstituencyDetail = async (constituencyId: string, fy?: string) => {
    try {
      setLoading(true)
      const res = await constituenciesApi.getDetail(constituencyId, fy)
      setData(res)
    } catch (err) {
      console.error('Failed to load constituency detail', err)
    } finally {
      setLoading(false)
    }
  }

  const loadWorks = async () => {
    if (!id) return
    try {
      setWorksLoading(true)
      const res = await worksApi.list({
        constituency_id: id,
        search: searchQuery || undefined,
        work_category: selectedCategory || undefined,
        work_status: selectedStatus || undefined,
        page: workParams.page,
        per_page: workParams.per_page,
      })
      setWorks(res.data || [])
      setTotalWorks(res.pagination?.total_records || 0)
    } catch (err) {
      console.error('Failed to load works', err)
    } finally {
      setWorksLoading(false)
    }
  }

  const handleRowClick = (work: Work) => {
    setSelectedWork(work)
    setDrawerOpen(true)
  }

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="Loading Constituency Intelligence Profile..." />
      </div>
    )
  }

  const c = data.constituency || ({} as any)
  const risk = data.risk || ({} as any)
  const riskScore = risk.risk_score ?? c.risk_score ?? 0
  const riskTier = risk.risk_tier || c.risk_tier || 'LOW'
  const utilizationRate = risk.fund_utilization_rate ?? c.fund_utilization_rate ?? (
    (risk.total_expenditure && risk.total_funds_released) ? (risk.total_expenditure / risk.total_funds_released * 100) : null
  )
  const released = Number(risk.total_funds_released ?? c.total_funds_released ?? 0)
  const expenditure = Number(risk.total_expenditure ?? c.total_expenditure ?? 0)

  const compAvg: any = data.risk_components_avg || data.radar_data || {}
  const radar = [
    { subject: 'Cost Risk', value: Number(compAvg.cost_risk ?? (compAvg.cost_overrun ? compAvg.cost_overrun * 4 : 0)), fullMark: 100 },
    { subject: 'Delay Risk', value: Number(compAvg.delay_risk ?? (compAvg.delay ? compAvg.delay * 4 : 0)), fullMark: 100 },
    { subject: 'Payment Risk', value: Number(compAvg.payment_risk ?? 0), fullMark: 100 },
    { subject: 'Duplicate Risk', value: Number(compAvg.duplicate_risk ?? (compAvg.duplicate ? compAvg.duplicate * 4 : 0)), fullMark: 100 },
    { subject: 'Compliance Risk', value: Number(compAvg.compliance_risk ?? 0), fullMark: 100 },
    { subject: 'Durability Risk', value: Number(compAvg.durability_risk ?? 0), fullMark: 100 },
  ]

  const timelineData = (data.expenditure_timeline || []).map((t: any) => ({
    fy: t.financial_year || t.month || 'Current',
    Expenditure: Number(((t.expenditure || 0) / 1e5).toFixed(2)),
    Released: Number(((t.released || 0) / 1e5).toFixed(2)),
    Rate: t.fund_utilization_rate,
  }))

  const releasedLakhs = Number((released / 1e5).toFixed(2))
  const expenditureLakhs = Number((expenditure / 1e5).toFixed(2))
  const unutilizedLakhs = Number(Math.max(0, released - expenditure) / 1e5).toFixed(2)
  const overrunLakhs = Number(Math.max(0, expenditure - released) / 1e5).toFixed(2)

  const reconciliationPie = Number(overrunLakhs) > 0 ? [
    { name: 'Sanctioned Funds Released', value: releasedLakhs, fill: '#3b82f6' },
    { name: 'Overrun Expenditure Deficit', value: Number(overrunLakhs), fill: '#ef4444' },
  ] : [
    { name: 'Actual Disbursed Expenditure', value: expenditureLakhs, fill: '#10b981' },
    { name: 'Unutilized Released Balance', value: Number(unutilizedLakhs), fill: '#3b82f6' },
  ]

  const effectiveChartType = timelineData.length === 0 ? 'donut' : chartType

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Space size={16} align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            style={{ background: '#ffffff', borderColor: '#cbd5e1', color: '#334155' }}
          >
            Back
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Title level={3} style={{ color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                {c.name || 'Constituency'} Constituency
              </Title>
              <RiskBadge tier={riskTier} score={riskScore} showScore />
            </div>
            <Text style={{ color: '#475569', fontSize: '13px' }}>
              {c.district || c.name || 'District'} &bull; {c.state || 'State'} &bull; MP: {c.mp_name || 'N/A'}
            </Text>
          </div>
        </Space>

        <Space align="center" size={12}>
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Financial Year:</span>
          <Select
            value={selectedFy}
            onChange={(v) => setSelectedFy(v)}
            style={{ width: 140 }}
            options={[
              { label: 'MPLADS', value: '2024-25' },
              { label: 'FY 2023-24', value: '2023-24' },
              { label: 'FY 2022-23', value: '2022-23' },
              { label: 'FY 2021-22', value: '2021-22' },
            ]}
          />
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Composite Risk Score"
            value={`${riskScore} / 100`}
            prefix={<WarningOutlined />}
            color={riskTier === 'CRITICAL' ? '#b91c1c' : riskTier === 'HIGH' ? '#c2410c' : '#15803d'}
            subtitle={`Risk Severity: ${riskTier}`}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Fund Utilization Rate"
            value={utilizationRate !== null && utilizationRate !== undefined ? `${Number(utilizationRate).toFixed(1)}%` : 'N/A'}
            prefix={<DollarOutlined />}
            color="#1d4ed8"
            subtitle="Actual vs Released Ratio"
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Total Funds Released"
            value={`₹${(released / 1e7).toFixed(2)} Cr`}
            prefix={<CheckCircleOutlined />}
            color="#0284c7"
            subtitle={`${c.name || 'Constituency'} Releases`}
          />
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <KPICard
            title="Actual Expenditure"
            value={`₹${(expenditure / 1e7).toFixed(2)} Cr`}
            prefix={<ClockCircleOutlined />}
            color="#7c3aed"
            subtitle={`${totalWorks} Total Works Sanctioned`}
          />
        </Col>
      </Row>

      {/* Analytics Visualizations */}
      <Row gutter={[16, 16]}>
        {/* Radar: 6 Risk Dimensions */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#1d4ed8' }} />
                <span>6-Dimension Risk Radar Profile</span>
              </Space>
            }
            style={{ height: '100%', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <div style={{ height: 320, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radar}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Radar
                    name="Risk Contribution"
                    dataKey="value"
                    stroke="#1d4ed8"
                    fill="#1d4ed8"
                    fillOpacity={0.25}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Normalized 0-100 severity across Target 6 Dimensions
              </Text>
            </div>
          </Card>
        </Col>

        {/* Timeline / Releases vs Expenditure */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Space>
                  <DollarOutlined style={{ color: '#10b981' }} />
                  <span>Financial Reconciliation: Releases vs. Expenditure (₹ Lakhs)</span>
                </Space>
                <Segmented
                  size="small"
                  value={effectiveChartType}
                  onChange={(val) => setChartType(val as 'bar' | 'donut')}
                  options={[
                    { label: 'Milestone Bar', value: 'bar', disabled: timelineData.length === 0 },
                    { label: 'Allocation Donut', value: 'donut' },
                  ]}
                />
              </div>
            }
            style={{ height: '100%', borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <div style={{ height: 320, width: '100%' }}>
              {effectiveChartType === 'bar' && timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="fy" stroke="#475569" fontSize={12} />
                    <YAxis stroke="#475569" fontSize={12} />
                    <RechartsTooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
                      formatter={(val: any) => [`₹${val} L`, '']}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Bar dataKey="Released" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Released Funds" />
                    <Bar dataKey="Expenditure" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual Expenditure" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reconciliationPie}
                      cx="50%"
                      cy="48%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {reconciliationPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
                      formatter={(val: any) => [`₹${val} Lakhs`, '']}
                    />
                    <Legend wrapperStyle={{ paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Reconciliation data by financial milestones in {c.name}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Duplicate Pairs Component */}
      <DuplicatePairsCard pairs={data.duplicate_pairs || []} />

      {/* Works & Anomalies Tabs */}
      <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
        <Tabs
          defaultActiveKey="works"
          items={[
            {
              key: 'works',
              label: `Sanctioned Works List (${totalWorks})`,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Filters Bar */}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Input
                      placeholder="Search works by keyword..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: 260 }}
                      allowClear
                    />
                    <Select
                      placeholder="Category"
                      allowClear
                      style={{ width: 180 }}
                      value={selectedCategory}
                      onChange={(val) => {
                        setSelectedCategory(val)
                        setWorkParams((p) => ({ ...p, page: 1 }))
                      }}
                      options={[
                        { label: 'ROADS', value: 'ROADS' },
                        { label: 'EDUCATION', value: 'EDUCATION' },
                        { label: 'HEALTH', value: 'HEALTH' },
                        { label: 'DRINKING_WATER', value: 'DRINKING_WATER' },
                        { label: 'COMMUNITY_ASSETS', value: 'COMMUNITY_ASSETS' },
                        { label: 'SANITATION', value: 'SANITATION' },
                        { label: 'POWER', value: 'POWER' },
                        { label: 'SPORTS', value: 'SPORTS' },
                      ]}
                    />
                    <Select
                      placeholder="Status"
                      allowClear
                      style={{ width: 160 }}
                      value={selectedStatus}
                      onChange={(val) => {
                        setSelectedStatus(val)
                        setWorkParams((p) => ({ ...p, page: 1 }))
                      }}
                      options={[
                        { label: 'SANCTIONED', value: 'SANCTIONED' },
                        { label: 'IN_PROGRESS', value: 'IN_PROGRESS' },
                        { label: 'COMPLETED', value: 'COMPLETED' },
                        { label: 'ON_HOLD', value: 'ON_HOLD' },
                        { label: 'CANCELLED', value: 'CANCELLED' },
                      ]}
                    />
                  </div>

                  {/* Works Table */}
                  <Table
                    dataSource={works}
                    rowKey="id"
                    loading={worksLoading}
                    pagination={{
                      current: workParams.page,
                      pageSize: workParams.per_page,
                      total: totalWorks,
                      onChange: (page, pageSize) => setWorkParams({ page, per_page: pageSize }),
                      showSizeChanger: true,
                    }}
                    columns={[
                      {
                        title: 'Work Ref / Description',
                        render: (_: any, r: Work) => (
                          <div style={{ cursor: 'pointer' }} onClick={() => handleRowClick(r)}>
                            <div style={{ fontWeight: 600, color: '#1d4ed8' }}>{r.work_id}</div>
                            <Text style={{ color: '#475569', fontSize: '13px' }}>{r.work_description}</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Category',
                        dataIndex: 'work_category',
                        render: (val: string) => <Tag color="blue">{val}</Tag>,
                      },
                      {
                        title: 'Sanctioned / Spent',
                        render: (_: any, r: Work) => (
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>₹{(r.sanctioned_amount || 0).toLocaleString()}</div>
                            <Text style={{ color: '#475569', fontSize: '12px' }}>
                              Spent: ₹{(r.actual_expenditure || 0).toLocaleString()}
                            </Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'work_status',
                        render: (val: string) => {
                          const color = val === 'COMPLETED' ? 'green' : val === 'IN_PROGRESS' ? 'blue' : 'orange'
                          return <Tag color={color}>{val}</Tag>
                        },
                      },
                      {
                        title: 'Risk Score',
                        render: (_: any, r: Work) => <RiskBadge score={r.risk_score} tier={r.risk_tier} showScore />,
                      },
                      {
                        title: 'Investigation',
                        render: (_: any, r: Work) => (
                          <Button
                            size="small"
                            type="primary"
                            icon={<FileSearchOutlined />}
                            onClick={() => handleRowClick(r)}
                            style={{ background: '#1d4ed8', borderColor: '#1d4ed8' }}
                          >
                            Inspect Dossier
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'anomalies',
              label: `Active Anomalies (${(data.anomalies || []).length})`,
              children: (
                <Table
                  dataSource={data.anomalies || []}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  columns={[
                    {
                      title: 'Work Ref / Type',
                      render: (_: any, a: any) => (
                        <div>
                          <div style={{ fontWeight: 600, color: '#1d4ed8' }}>
                            {a.work_ref || 'Constituency Level'}
                          </div>
                          <Text style={{ color: '#475569', fontSize: '12px' }}>{a.anomaly_type}</Text>
                        </div>
                      ),
                    },
                    {
                      title: 'Category',
                      dataIndex: 'category',
                      render: (val: string) => <Tag color="geekblue">{val}</Tag>,
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
                      title: 'Detection Method',
                      dataIndex: 'detection_method',
                      render: (val: string) => <Tag>{val}</Tag>,
                    },
                    {
                      title: 'Action',
                      render: (_: any, a: any) => (
                        <Button
                          size="small"
                          type="default"
                          icon={<FileSearchOutlined />}
                          onClick={() => {
                            if (a.work_id) {
                              setSelectedWork({ id: a.work_id, work_id: a.work_ref } as any)
                              setDrawerOpen(true)
                            }
                          }}
                        >
                          Dossier
                        </Button>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Investigation Drawer */}
      <InvestigationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workId={selectedWork?.id ? String(selectedWork.id) : null}
        workRef={selectedWork?.work_id}
        onStatusChange={() => {
          if (id) {
            loadConstituencyDetail(id, selectedFy)
            loadWorks()
          }
        }}
      />
    </div>
  )
}

export default ConstituencyDetailPage
