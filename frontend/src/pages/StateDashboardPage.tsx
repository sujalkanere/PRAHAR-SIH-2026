import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Select, Typography, Table, Space, Tag, Spin, Input, Button, Drawer } from 'antd'
import {
  ProjectOutlined,
  DollarOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
} from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { analyticsApi } from '../api/analytics'
import { constituenciesApi } from '../api/constituencies'
import { ConstituencySummary } from '../types'
import { KPICard } from '../components/KPICard'
import { RiskBadge } from '../components/RiskBadge'
import { FundAgingWidget, FundAgingData } from '../components/FundAgingWidget'
import { StateSectorAnalyticsChart } from '../components/StateSectorAnalyticsChart'
import { CircularRiskScore } from '../components/CircularRiskScore'
import { InspectionCoverageTable } from '../components/InspectionCoverageTable'

const { Title, Text } = Typography

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli',
  'Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

export const StateDashboardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const currentState = searchParams.get('state') || 'Maharashtra'

  const [summary, setSummary] = useState<any>(null)
  const [agingData, setAgingData] = useState<FundAgingData | null>(null)
  const [constituencies, setConstituencies] = useState<ConstituencySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected project for the CircularRiskScore widget
  const [selectedProject, setSelectedProject] = useState<any>(null)
  // Drawer state for inspecting any table record
  const [inspectDrawerOpen, setInspectDrawerOpen] = useState(false)
  const [inspectingRecord, setInspectingRecord] = useState<any>(null)

  useEffect(() => {
    loadStateData(currentState)
    const handleRefresh = () => {
      loadStateData(currentState)
    }
    window.addEventListener('prahar:refresh-data', handleRefresh)
    return () => {
      window.removeEventListener('prahar:refresh-data', handleRefresh)
    }
  }, [currentState])

  const loadStateData = async (stateName: string) => {
    try {
      setLoading(true)
      const [summaryRes, agingRes] = await Promise.all([
        analyticsApi.getStateSummary(stateName),
        analyticsApi.getAging({ scope: stateName }).catch(() => null),
      ])
      setSummary(summaryRes)
      setAgingData(agingRes)

      // Set initial selected project for the circular risk score widget
      if (summaryRes?.high_risk_projects && summaryRes.high_risk_projects.length > 0) {
        setSelectedProject(summaryRes.high_risk_projects[0])
      } else {
        setSelectedProject({
          work_id: 'RW-303916',
          title: 'Project: RW-303916',
          work_description: 'Constructions of CC Road from Sona Traders Tehra TO Tohfiq Saheb Residence in Amar Colony',
          location: `Nanded, ${stateName}`,
          risk_score: 87,
          risk_tier: 'HIGH',
          risk_components: {
            cost_overrun: 84,
            delay: 79,
            duplicate: 42,
            pattern: 68,
            fund_utilization: 88,
          },
          reason: 'High Outlay Infrastructure: ₹10,00,000 allocated for civil works; under physical milestone scrutiny.',
        })
      }

      try {
        const constsRes = await constituenciesApi.list({ state: stateName })
        setConstituencies(constsRes.data && constsRes.data.length > 0 ? constsRes.data : summaryRes.constituencies || [])
      } catch {
        setConstituencies(summaryRes.constituencies || [])
      }
    } catch (err) {
      console.error('Failed to load state data', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStateChange = (val: string) => {
    setSearchParams({ state: val })
  }

  const filteredConstituencies = constituencies
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.district && c.district.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.mp_name && c.mp_name.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* State Header & Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ color: 'var(--text-primary)', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            State Risk Dashboard &bull; <span style={{ color: 'var(--color-primary)' }}>{currentState}</span>
          </Title>
          <Text style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            District-level aggregation, sector-wise fund progress, and project risk scoring
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Select State:</Text>
          <Select
            value={currentState}
            onChange={handleStateChange}
            style={{ width: 220 }}
            options={INDIAN_STATES.map((s) => ({ label: s, value: s }))}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <Spin size="large" tip="Loading State Intelligence Data..." />
        </div>
      ) : (
        <>
          {/* State KPIs */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={summary?.total_unspent_balance_cr !== undefined ? 5 : 6} style={{ flex: '1 1 180px' }}>
              <KPICard
                title="Constituencies"
                value={summary?.kpis?.find((k: any) => k.key === 'constituencies')?.value ?? summary?.constituencies?.length ?? constituencies.length}
                prefix={<ProjectOutlined />}
                color="#2563eb"
                subtitle="Monitored in this state"
              />
            </Col>

            <Col xs={24} sm={12} lg={summary?.total_unspent_balance_cr !== undefined ? 5 : 6} style={{ flex: '1 1 180px' }}>
              <KPICard
                title="State Expenditure"
                value={Number(summary?.kpis?.find((k: any) => k.key === 'expenditure' || k.key === 'total_expenditure')?.value ?? summary?.total_expenditure_cr ?? 0).toFixed(2)}
                suffix=" Cr"
                prefix={<DollarOutlined />}
                color="#059669"
                subtitle="Cumulative actual expenditure"
              />
            </Col>

            {summary?.total_unspent_balance_cr !== undefined && (
              <Col xs={24} sm={12} lg={5} style={{ flex: '1 1 180px' }}>
                <KPICard
                  title="Unspent Balance"
                  value={Number(summary.total_unspent_balance_cr).toFixed(2)}
                  suffix=" Cr"
                  prefix={<ClockCircleOutlined />}
                  color="#d97706"
                  subtitle={
                    summary.oldest_unspent_project_days
                      ? `Max idle: ${summary.oldest_unspent_project_days}d`
                      : 'Unspent allocated balance'
                  }
                />
              </Col>
            )}

            <Col xs={24} sm={12} lg={summary?.total_unspent_balance_cr !== undefined ? 5 : 6} style={{ flex: '1 1 180px' }}>
              <KPICard
                title="High-Risk Constituencies"
                value={summary?.kpis?.find((k: any) => k.key === 'high_risk')?.value ?? summary?.high_risk_count ?? constituencies.filter((c) => (c.risk_score || 0) >= 50).length}
                prefix={<WarningOutlined />}
                color="#ea580c"
                subtitle="Scored in High/Critical tier"
              />
            </Col>

            <Col xs={24} sm={12} lg={summary?.total_unspent_balance_cr !== undefined ? 4 : 6} style={{ flex: '1 1 180px' }}>
              <KPICard
                title="Active State Anomalies"
                value={summary?.kpis?.find((k: any) => k.key === 'anomalies')?.value ?? summary?.active_anomalies ?? 0}
                prefix={<AlertOutlined />}
                color="#dc2626"
                subtitle="Under active review"
              />
            </Col>
          </Row>

          {/* Development Sector Breakdown & Circular Risk Scorecard */}
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={15}>
              <StateSectorAnalyticsChart
                state={currentState}
                sectorBreakdown={summary?.sector_breakdown}
                districtBreakdown={summary?.district_breakdown}
              />
            </Col>
            <Col xs={24} xl={9}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      Project Risk Scorecard
                    </span>
                    {summary?.high_risk_projects && summary.high_risk_projects.length > 0 && (
                      <Select
                        showSearch
                        size="small"
                        style={{ width: 220 }}
                        placeholder="Select Work..."
                        value={selectedProject?.work_id}
                        onChange={(wid) => {
                          const p = summary.high_risk_projects.find((item: any) => item.work_id === wid)
                          if (p) setSelectedProject(p)
                        }}
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) ||
                          (option?.value ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                        options={summary.high_risk_projects.map((p: any) => ({
                          label: `${p.work_id} • Score ${p.risk_score}`,
                          value: p.work_id,
                        }))}
                      />
                    )}
                  </div>
                }
                style={{
                  borderRadius: 18,
                  border: '1px solid var(--border-primary)',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  background: 'var(--bg-surface)',
                }}
                bodyStyle={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <CircularRiskScore
                  score={selectedProject?.risk_score ?? 87}
                  tier={selectedProject?.risk_tier ?? 'HIGH'}
                  projectTitle={selectedProject?.title ?? `Project: ${selectedProject?.work_id ?? 'MP-27'}`}
                  description={selectedProject?.work_description ?? 'Rural Road Construction'}
                  location={selectedProject?.location ?? `${selectedProject?.district ?? 'XYZ'}, ${currentState}`}
                  showComponents={true}
                  components={selectedProject?.risk_components}
                  style={{ width: '100%', maxWidth: '100%', boxShadow: 'none', border: 'none', padding: 0 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Fund Aging & Idle Balance Tracker */}
          <FundAgingWidget
            data={agingData}
            title={`Idle Fund Aging & Stalled Works • ${currentState}`}
          />

          {/* District Physical Inspection Coverage Tracker */}
          <Row gutter={[16, 16]}>
            <Col xs={24}>
              <InspectionCoverageTable state={currentState} constituencies={filteredConstituencies} />
            </Col>
          </Row>

          {/* Constituency Risk Audit Table */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <span>Constituency Risk Audit &bull; {currentState}</span>
                <Input
                  prefix={<SearchOutlined style={{ color: '#475569' }} />}
                  placeholder="Search constituency, district, MP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 280 }}
                />
              </div>
            }
            bodyStyle={{ padding: 0 }}
          >
            <Table
              dataSource={filteredConstituencies}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: 'Constituency Name',
                  dataIndex: 'name',
                  render: (val: string, record: any) => (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
                      <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>MP: {record.mp_name || 'N/A'}</Text>
                    </div>
                  ),
                },
                {
                  title: 'District',
                  dataIndex: 'district',
                  render: (val: string) => <Tag color="blue">{val || 'N/A'}</Tag>,
                },
                {
                  title: 'Risk Tier',
                  dataIndex: 'risk_tier',
                  render: (_: any, record: any) => (
                    <RiskBadge tier={record.risk_tier} score={record.risk_score} showScore />
                  ),
                },
                {
                  title: 'SC/ST Compliance',
                  dataIndex: 'sc_st_compliance_status',
                  render: (val: string | undefined, record: any) => {
                    const status = val || record.sc_st_compliance?.compliance_status
                    let color = 'default'
                    let label = 'N/A'
                    if (status === 'COMPLIANT') {
                      color = 'success'
                      label = 'Compliant'
                    } else if (status === 'AT_RISK') {
                      color = 'warning'
                      label = 'At Risk'
                    } else if (status === 'NON_COMPLIANT' || status === 'VIOLATION') {
                      color = 'error'
                      label = 'Violation'
                    } else if (status === 'NOT_APPLICABLE') {
                      color = 'default'
                      label = 'Exempt'
                    }

                    const scActual = record.sc_pct_actual ?? record.sc_st_compliance?.sc_pct_actual
                    const stActual = record.st_pct_actual ?? record.sc_st_compliance?.st_pct_actual

                    return (
                      <div>
                        <Tag color={color} style={{ fontWeight: 600, borderRadius: 4 }}>
                          {label}
                        </Tag>
                        {scActual !== undefined && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>
                            SC: {Number(scActual).toFixed(1)}% | ST: {Number(stActual ?? 0).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    )
                  },
                },
                {
                  title: 'Total Works',
                  dataIndex: 'total_works',
                  render: (val: number) => <span style={{ fontWeight: 600 }}>{val || 0}</span>,
                },
                {
                  title: 'Fund Utilization Rate',
                  dataIndex: 'fund_utilization_rate',
                  render: (val: number | null) => (
                    <span
                      style={{
                        fontWeight: 600,
                        color: val !== null && val < 50 ? '#dc2626' : val !== null && val > 100 ? '#ea580c' : '#059669',
                      }}
                    >
                      {val !== null ? `${val.toFixed(1)}%` : 'N/A'}
                    </span>
                  ),
                },
                {
                  title: 'Active Anomalies',
                  dataIndex: 'active_anomalies',
                  render: (val: number) => (
                    <Tag color={val > 0 ? 'red' : 'green'}>{val || 0}</Tag>
                  ),
                },
                {
                  title: 'Audit Actions',
                  render: (_: any, record: any) => (
                    <Space size="middle">
                      <Button
                        type="link"
                        size="small"
                        icon={<DashboardOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setInspectingRecord(record)
                          setInspectDrawerOpen(true)
                        }}
                        style={{ padding: 0, fontWeight: 600, color: '#e11d48' }}
                      >
                        Inspect Risk
                      </Button>
                      {user && (
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/constituency/${record.id}`)
                          }}
                          style={{ padding: 0 }}
                        >
                          View Detail
                        </Button>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </Card>

          {/* Interactive Project/Constituency Risk Scorecard Drawer */}
          <Drawer
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DashboardOutlined style={{ color: '#e11d48' }} />
                <span>Risk Scorecard Intelligence</span>
              </div>
            }
            open={inspectDrawerOpen}
            onClose={() => setInspectDrawerOpen(false)}
            width={440}
          >
            {inspectingRecord && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <CircularRiskScore
                  score={inspectingRecord.risk_score ?? 87}
                  tier={inspectingRecord.risk_tier ?? 'HIGH'}
                  projectTitle={`Constituency: ${inspectingRecord.name}`}
                  description={`MP: ${inspectingRecord.mp_name || 'Honble MP'}`}
                  location={`${inspectingRecord.district || inspectingRecord.name}, ${currentState}`}
                  showComponents={true}
                  components={{
                    cost_overrun: Math.min(100, Math.round((inspectingRecord.risk_score || 70) * 0.95)),
                    delay: Math.min(100, Math.round((inspectingRecord.risk_score || 70) * 1.05)),
                    duplicate: Math.min(100, Math.round((inspectingRecord.risk_score || 70) * 0.6)),
                    pattern: Math.min(100, Math.round((inspectingRecord.risk_score || 70) * 0.85)),
                    fund_utilization: Math.min(100, Math.round((inspectingRecord.risk_score || 70) * 1.02)),
                  }}
                  style={{ width: '100%', maxWidth: '100%', boxShadow: 'none' }}
                />

                <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#0f172a' }}>
                    Constituency Baseline Overview
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Total Projects Monitored:</span>
                    <span style={{ fontWeight: 600 }}>{inspectingRecord.total_works || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Fund Utilization Rate:</span>
                    <span style={{ fontWeight: 600 }}>
                      {inspectingRecord.fund_utilization_rate !== null ? `${Number(inspectingRecord.fund_utilization_rate).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Active Irregularity Alerts:</span>
                    <Tag color={inspectingRecord.active_anomalies > 0 ? 'red' : 'green'}>
                      {inspectingRecord.active_anomalies || 0} Active
                    </Tag>
                  </div>
                  {user && (
                    <Button
                      type="primary"
                      block
                      style={{ marginTop: 12, borderRadius: 8 }}
                      onClick={() => {
                        setInspectDrawerOpen(false)
                        navigate(`/constituency/${inspectingRecord.id}`)
                      }}
                    >
                      Open Full Project Ledger
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Drawer>
        </>
      )}
    </div>
  )
}

export default StateDashboardPage
