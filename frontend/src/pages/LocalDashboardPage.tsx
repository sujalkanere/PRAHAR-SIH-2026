import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, Spin, Table, Tag, List, Avatar } from 'antd'
import { 
  AlertOutlined, 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  FundProjectionScreenOutlined 
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'
import { worksApi } from '../api/works'
import { anomaliesApi } from '../api/anomalies'
import { RiskBadge } from '../components/RiskBadge'

const { Title, Text } = Typography

export const LocalDashboardPage: React.FC = () => {
  const { user } = useAuth()
  const [works, setWorks] = useState<any[]>([])
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [worksRes, anomRes] = await Promise.all([
        worksApi.list({ per_page: 5 }),
        anomaliesApi.list({ status: 'NEW', per_page: 10 })
      ])
      setWorks(worksRes.data || [])
      setAnomalies(anomRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Spin size="large" tip="Loading Local Intelligence..." />
      </div>
    )
  }

  const highRiskWorks = works.filter(w => (w.risk_score || 0) >= 50).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Title level={3} style={{ margin: 0, fontFamily: 'Outfit' }}>
          Local Dashboard &bull; <span style={{ color: 'var(--color-primary)' }}>{user?.scope_value || 'Local Area'}</span>
        </Title>
        <Text style={{ color: 'var(--text-secondary)' }}>
          {user?.role === 'ROLE_MP' ? 'Constituency level oversight and risk monitoring' : 'District level oversight and risk monitoring'}
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar size={48} style={{ background: '#dcfce7', color: '#15803d' }} icon={<FundProjectionScreenOutlined />} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Recent Active Works</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{works.length}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar size={48} style={{ background: '#fee2e2', color: '#dc2626' }} icon={<AlertOutlined />} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Actionable Alerts</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{anomalies.length}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar size={48} style={{ background: '#fef3c7', color: '#d97706' }} icon={<ClockCircleOutlined />} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>High Risk Projects</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{highRiskWorks}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card title="Recent Active Works" style={{ borderRadius: 12, border: '1px solid var(--border-primary)' }}>
            <Table
              dataSource={works}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Title', dataIndex: 'title', render: (val: string) => <Text strong>{val}</Text> },
                { title: 'Status', dataIndex: 'work_status', render: (val: string) => <Tag color="blue">{val}</Tag> },
                { title: 'Risk Score', render: (r: any) => <RiskBadge score={r.risk_score} tier={r.risk_tier} /> }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="District-Scoped Anomaly Alerts" style={{ borderRadius: 12, border: '1px solid var(--border-primary)' }}>
            <List
              itemLayout="horizontal"
              dataSource={anomalies}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<AlertOutlined />} style={{ background: item.severity === 'CRITICAL' ? '#dc2626' : '#ea580c' }} />}
                    title={<Text strong style={{ color: item.severity === 'CRITICAL' ? '#dc2626' : 'inherit' }}>{item.anomaly_type}</Text>}
                    description={
                      <div>
                        <div style={{ fontSize: 12 }}>{item.note || 'Anomaly detected'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {new Date(item.detected_at).toLocaleDateString()}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
