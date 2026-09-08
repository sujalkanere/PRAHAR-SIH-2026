import React, { useEffect, useState } from 'react'
import {
  Drawer,
  Spin,
  Alert,
  Space,
  Tag,
  Typography,
  Divider,
  Progress,
  Row,
  Col,
  Card,
  Button,
  Select,
  Input,
  message,
  Timeline,
  Tooltip,
} from 'antd'
import {
  ShieldAlert,
  FileText,
  Clock,
  Coins,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { apiClient as api } from '../api/client'
import { RiskBadge } from './RiskBadge'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface InvestigationDrawerProps {
  open: boolean
  onClose: () => void
  workId: string | null
  workRef?: string
  anomalyId?: string
  onStatusChange?: () => void
}

export const InvestigationDrawer: React.FC<InvestigationDrawerProps> = ({
  open,
  onClose,
  workId,
  workRef,
  anomalyId,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(false)
  const [workData, setWorkData] = useState<any>(null)
  const [explanation, setExplanation] = useState<any>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('UNDER_REVIEW')
  const [investigationNote, setInvestigationNote] = useState<string>('')
  const [submittingAction, setSubmittingAction] = useState(false)

  useEffect(() => {
    if (!open || !workId) {
      setWorkData(null)
      setExplanation(null)
      return
    }

    const fetchWorkDetail = async () => {
      setLoading(true)
      try {
        const res = await api.get(`/works/${workId}`)
        setWorkData(res.data)
        if (res.data.explanation) {
          setExplanation(res.data.explanation)
        } else {
          const expRes = await api.get(`/works/${workId}/explanation`)
          setExplanation(expRes.data)
        }
      } catch (err: any) {
        console.error('Failed to fetch investigation detail', err)
        message.error('Failed to load work investigation details')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkDetail()
  }, [open, workId])

  const handleUpdateStatus = async (targetAnomalyId?: string) => {
    const aId = targetAnomalyId || anomalyId || (workData?.anomalies?.[0]?.id)
    if (!aId) {
      message.warning('No active alert linked to update')
      return
    }
    setSubmittingAction(true)
    try {
      await api.patch(`/anomalies/${aId}`, {
        status: selectedStatus,
        note: investigationNote || undefined,
      })
      message.success(`Investigation status updated to ${selectedStatus}`)
      setInvestigationNote('')
      if (onStatusChange) onStatusChange()
      // Refresh local work data
      const refreshed = await api.get(`/works/${workId}`)
      setWorkData(refreshed.data)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to update alert status')
    } finally {
      setSubmittingAction(false)
    }
  }

  const work = workData?.work || {}
  const risk = workData?.risk_score || {}
  const components = risk?.components || {}
  const anomalies = workData?.anomalies || []

  // Extract 6 target dimensions (0-100)
  const riskDimensions = [
    { key: 'cost_risk', label: 'Cost Risk', weight: '20%', val: components.cost_risk ?? (components.cost_overrun ? components.cost_overrun * 4 : 0), icon: Coins },
    { key: 'delay_risk', label: 'Delay Risk', weight: '15%', val: components.delay_risk ?? (components.delay ? components.delay * 4 : 0), icon: Clock },
    { key: 'payment_risk', label: 'Payment Risk', weight: '15%', val: components.payment_risk ?? 0, icon: Coins },
    { key: 'duplicate_risk', label: 'Duplicate Risk', weight: '20%', val: components.duplicate_risk ?? (components.duplicate ? components.duplicate * 4 : 0), icon: Copy },
    { key: 'compliance_risk', label: 'Compliance Risk', weight: '15%', val: components.compliance_risk ?? 0, icon: CheckCircle2 },
    { key: 'durability_risk', label: 'Durability Risk', weight: '15%', val: components.durability_risk ?? 0, icon: ShieldAlert },
  ]

  const getDimensionColor = (score: number) => {
    if (score >= 75) return '#b91c1c'
    if (score >= 50) return '#c2410c'
    if (score >= 25) return '#b45309'
    return '#15803d'
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space align="center" size={10}>
            <ShieldAlert size={20} color="#1d4ed8" />
            <span style={{ fontWeight: 700 }}>Investigation Dossier: {workRef || work.work_id || workId}</span>
          </Space>
          {risk.tier && <RiskBadge score={risk.score ?? 0} tier={risk.tier} />}
        </Space>
      }
      styles={{
        body: { padding: '24px', background: '#f8fafc' },
      }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading auditable evidence dossier..." />
        </div>
      ) : !workData ? (
        <Alert type="info" message="No work record available for investigation" />
      ) : (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {/* Top Summary Card */}
          <Card
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col span={16}>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>
                  {work.constituency_name} ({work.state_name}) • {work.work_category}
                </div>
                <Title level={4} style={{ margin: '4px 0 8px 0', color: '#0f172a' }}>
                  {work.work_description}
                </Title>
                <Space size={8} wrap>
                  <Tag color="blue">{work.financial_year}</Tag>
                  <Tag color={work.work_status === 'COMPLETED' ? 'green' : 'orange'}>{work.work_status}</Tag>
                  <Tag icon={<Building size={12} style={{ marginRight: 4 }} />}>{work.implementing_agency || 'District Authority'}</Tag>
                </Space>
              </Col>
              <Col span={8} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>COMPOSITE RISK</div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: getDimensionColor(risk.score ?? 0),
                    lineHeight: 1.2,
                  }}
                >
                  {risk.score ?? 0}
                  <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 500 }}>/100</span>
                </div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {risk.tier} SEVERITY TIER
                </Text>
              </Col>
            </Row>
          </Card>

          {/* 6 Target Risk Dimensions Breakdown */}
          <Card
            title={
              <Space>
                <ShieldAlert size={16} color="#1d4ed8" />
                <span>Analytical Risk Components (Target 6-Dimension Engine)</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          >
            <Row gutter={[16, 16]}>
              {riskDimensions.map((dim) => {
                const Icon = dim.icon
                const score = dim.val
                const color = getDimensionColor(score)
                return (
                  <Col span={12} key={dim.key}>
                    <div
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Space size={6}>
                          <Icon size={14} color="#475569" />
                          <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{dim.label}</span>
                        </Space>
                        <span style={{ fontWeight: 700, fontSize: 13, color }}>
                          {score > 0 ? `${score}/100` : 'Normal'}
                        </span>
                      </div>
                      <Progress
                        percent={score}
                        strokeColor={color}
                        showInfo={false}
                        size={['100%', 6]}
                        style={{ margin: 0 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Weight: {dim.weight}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: score >= 50 ? color : '#475569' }}>
                          {score >= 75 ? 'Critical' : score >= 50 ? 'High' : score > 0 ? 'Watch' : 'Normal'}
                        </span>
                      </div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Card>

          {/* Evidence and Provenance Findings */}
          <Card
            title={
              <Space>
                <FileText size={16} color="#1d4ed8" />
                <span>Structured Evidence & Deterministic Signals</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          >
            {explanation?.key_reasons && explanation.key_reasons.length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                  Primary Risk Factors
                </div>
                {explanation.key_reasons.map((r: string, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: '8px 12px',
                      background: '#fff7ed',
                      borderLeft: '3px solid #f97316',
                      borderRadius: '0 6px 6px 0',
                      marginBottom: 6,
                    }}
                  >
                    <AlertTriangle size={15} color="#ea580c" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#9a3412', fontWeight: 500 }}>{r}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {explanation?.evidence && explanation.evidence.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
                  Auditable Metrics vs Thresholds
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Dimension</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Rule ID</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Value</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Threshold</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Confidence</th>
                        <th style={{ padding: '8px 12px', color: '#475569' }}>Provenance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explanation.evidence.map((e: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{e.dimension}</td>
                          <td style={{ padding: '8px 12px' }}><Tag color="blue">{e.rule_id}</Tag></td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#b91c1c' }}>{e.value}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{e.threshold}</td>
                          <td style={{ padding: '8px 12px' }}>{Math.round(e.confidence * 100)}%</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{e.provenance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {explanation?.limitations && explanation.limitations.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {explanation.limitations.map((lim: string, idx: number) => (
                  <div key={idx} style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
                    ℹ️ {lim}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Financial & Timeline Metrics */}
          <Card title="Sanction & Financial Verification" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Row gutter={[16, 12]}>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>SANCTIONED AMOUNT</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  ₹{(work.sanctioned_amount || 0).toLocaleString()}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>ACTUAL EXPENDITURE</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  ₹{(work.actual_expenditure || 0).toLocaleString()}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>COST OVERRUN</div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: (work.cost_overrun_percentage || 0) > 0 ? '#b91c1c' : '#15803d',
                  }}
                >
                  {work.cost_overrun_percentage || 0}%
                </div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>SANCTION DATE</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{work.sanction_date || 'N/A'}</div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>EXPECTED COMPLETION</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{work.expected_completion_date || 'N/A'}</div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 11, color: '#475569' }}>COMPLETION DATE</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{work.completion_date || 'In Progress'}</div>
              </Col>
            </Row>
          </Card>

          {/* Human-in-the-Loop Investigation Action Workflow */}
          <Card
            title={
              <Space>
                <Send size={16} color="#1d4ed8" />
                <span>Investigator Action & Audit Decision</span>
              </Space>
            }
            style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
          >
            <Space orientation="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Update Review / Audit Status
                </div>
                <Select
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'UNDER_REVIEW', label: 'Under Formal Review (Officer Assigned)' },
                    { value: 'ACKNOWLEDGED', label: 'Acknowledged (Preliminary Inquiry)' },
                    { value: 'RESOLVED', label: 'Resolved / Action Completed' },
                    { value: 'FALSE_POSITIVE', label: 'Dismiss as False Positive (Documented Reason)' },
                  ]}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Investigator Findings / Evidence Notes
                </div>
                <TextArea
                  rows={3}
                  value={investigationNote}
                  onChange={(e) => setInvestigationNote(e.target.value)}
                  placeholder="Record verification notes, site inspection references, or clearance explanation..."
                />
              </div>
              <Button
                type="primary"
                icon={<Send size={14} />}
                loading={submittingAction}
                onClick={() => handleUpdateStatus()}
                style={{ background: '#1d4ed8', borderColor: '#1d4ed8' }}
              >
                Record Audit Action & Update Dossier
              </Button>
            </Space>
          </Card>
        </Space>
      )}
    </Drawer>
  )
}
