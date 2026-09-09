import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Select, Typography, Table, Space, Tag, Spin, Input } from 'antd'
import {
  ProjectOutlined,
  DollarOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { analyticsApi } from '../api/analytics'
import { constituenciesApi } from '../api/constituencies'
import { ConstituencySummary } from '../types'
import { KPICard } from '../components/KPICard'
import { RiskBadge } from '../components/RiskBadge'

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
  const { hasRole } = useAuth()
  const currentState = searchParams.get('state') || 'Maharashtra'

  const [summary, setSummary] = useState<any>(null)
  const [constituencies, setConstituencies] = useState<ConstituencySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadStateData(currentState)
  }, [currentState])

  const loadStateData = async (stateName: string) => {
    try {
      setLoading(true)
      const summaryRes = await analyticsApi.getStateSummary(stateName)
      setSummary(summaryRes)
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

  const filteredConstituencies = constituencies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.district && c.district.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.mp_name && c.mp_name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* State Header & Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            State Risk Dashboard &bull; <span style={{ color: '#1d4ed8' }}>{currentState}</span>
          </Title>
          <Text style={{ color: '#475569', fontSize: '13px' }}>
            District-level aggregation and constituency risk monitoring
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: '#475569', fontSize: '13px' }}>Select State:</Text>
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
            <Col xs={24} sm={12} lg={6}>
              <KPICard
                title="Constituencies"
                value={summary?.kpis?.find((k: any) => k.key === 'constituencies')?.value ?? summary?.constituencies?.length ?? constituencies.length}
                prefix={<ProjectOutlined />}
                color="#2563eb"
                subtitle="Monitored in this state"
              />
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <KPICard
                title="State Expenditure"
                value={Number(summary?.kpis?.find((k: any) => k.key === 'expenditure' || k.key === 'total_expenditure')?.value ?? summary?.total_expenditure_cr ?? 0).toFixed(2)}
                suffix=" Cr"
                prefix={<DollarOutlined />}
                color="#059669"
                subtitle="Cumulative actual expenditure"
              />
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <KPICard
                title="High-Risk Constituencies"
                value={summary?.kpis?.find((k: any) => k.key === 'high_risk')?.value ?? summary?.high_risk_count ?? constituencies.filter((c) => (c.risk_score || 0) >= 50).length}
                prefix={<WarningOutlined />}
                color="#ea580c"
                subtitle="Scored in High/Critical tier"
              />
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <KPICard
                title="Active State Anomalies"
                value={summary?.kpis?.find((k: any) => k.key === 'anomalies')?.value ?? summary?.active_anomalies ?? 0}
                prefix={<AlertOutlined />}
                color="#dc2626"
                subtitle="Under active review"
              />
            </Col>
          </Row>

          {/* District Breakdown & Constituencies Table */}
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
              onRow={(record) => ({
                onClick: () => {
                  if (hasRole('ROLE_PUBLIC')) return
                  navigate(`/constituency/${record.id}`)
                },
                style: { cursor: hasRole('ROLE_PUBLIC') ? 'default' : 'pointer' },
              })}
              columns={[
                {
                  title: 'Constituency Name',
                  dataIndex: 'name',
                  render: (val: string, record: any) => (
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{val}</div>
                      <Text style={{ color: '#475569', fontSize: '12px' }}>MP: {record.mp_name || 'N/A'}</Text>
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
                ...(!hasRole('ROLE_PUBLIC')
                  ? [
                      {
                        title: 'Action',
                        render: () => (
                          <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <EyeOutlined /> View Detail
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </Card>
        </>
      )}
    </div>
  )
}
