import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Select,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  message,
  Typography,
  Space,
  Drawer,
  Timeline,
  Spin,
} from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  EditOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import { anomaliesApi, AnomalyListParams } from '../api/anomalies'
import { Anomaly, AuditTrailItem, AnomalyStatus } from '../types'
import { RiskBadge } from '../components/RiskBadge'
import { InvestigationDrawer } from '../components/InvestigationDrawer'

const { Title, Text } = Typography
const { TextArea } = Input

const VALID_TRANSITIONS: Record<AnomalyStatus, AnomalyStatus[]> = {
  NEW: ['ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'],
  ACKNOWLEDGED: ['UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE'],
  UNDER_REVIEW: ['RESOLVED', 'FALSE_POSITIVE', 'ACKNOWLEDGED'],
  RESOLVED: ['UNDER_REVIEW'],
  FALSE_POSITIVE: ['UNDER_REVIEW'],
}

export const AlertManagementPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [params, setParams] = useState<AnomalyListParams>({
    page: 1,
    per_page: 10,
  })
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined)
  const [selectedSeverity, setSelectedSeverity] = useState<string | undefined>(undefined)
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)

  // Investigation Dossier Drawer
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null)
  const [selectedWorkRef, setSelectedWorkRef] = useState<string | undefined>(undefined)
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | undefined>(undefined)
  const [investigationDrawerOpen, setInvestigationDrawerOpen] = useState(false)

  // Status Update Modal
  const [updatingAnomaly, setUpdatingAnomaly] = useState<Anomaly | null>(null)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateForm] = Form.useForm()

  // Audit Trail Drawer
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false)
  const [auditItems, setAuditItems] = useState<AuditTrailItem[]>([])
  const [activeAnomalyRef, setActiveAnomalyRef] = useState<string>('')
  const [auditLoading, setAuditLoading] = useState(false)

  useEffect(() => {
    loadAnomalies()
  }, [params, selectedType, selectedSeverity, selectedStatus])

  const loadAnomalies = async () => {
    try {
      setLoading(true)
      const res = await anomaliesApi.list({
        anomaly_type: selectedType || undefined,
        severity: selectedSeverity || undefined,
        status: selectedStatus || undefined,
        page: params.page,
        per_page: params.per_page,
      })
      setAnomalies(res.data || [])
      setTotal(res.pagination?.total_records || 0)
    } catch (err) {
      console.error('Failed to load anomalies', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenStatusModal = (record: Anomaly) => {
    setUpdatingAnomaly(record)
    const allowed = VALID_TRANSITIONS[record.status] || []
    updateForm.setFieldsValue({
      status: allowed[0] || record.status,
      note: '',
    })
    setUpdateModalOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (!updatingAnomaly) return
    try {
      const values = await updateForm.validateFields()
      setUpdateLoading(true)
      await anomaliesApi.updateStatus(updatingAnomaly.id, {
        status: values.status,
        note: values.note,
      })
      message.success(`Status updated to ${values.status}`)
      setUpdateModalOpen(false)
      loadAnomalies()
    } catch (err: any) {
      if (err?.response?.data?.message) {
        message.error(err.response.data.message)
      } else {
        message.error('Failed to update status')
      }
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleViewAudit = async (record: Anomaly) => {
    setActiveAnomalyRef(record.work_ref || record.anomaly_type)
    setAuditDrawerOpen(true)
    try {
      setAuditLoading(true)
      const res = await anomaliesApi.getAuditTrail(record.id)
      setAuditItems(res || [])
    } catch (err) {
      console.error('Failed to load audit trail', err)
      message.error('Failed to load audit history')
    } finally {
      setAuditLoading(false)
    }
  }

  const handleOpenInvestigation = (record: Anomaly) => {
    setSelectedWorkId(record.work_id || record.work_ref || null)
    setSelectedWorkRef(record.work_ref || undefined)
    setSelectedAnomalyId(record.id)
    setInvestigationDrawerOpen(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div>
        <Title level={3} style={{ margin: 0, fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
          Alert & Anomaly Investigation Management
        </Title>
        <Text style={{ color: '#475569', fontSize: '13px' }}>
          Triage, review, inspect auditable dossiers, and assign verified status transitions
        </Text>
      </div>

      {/* Filter Bar & Table Card */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Space>
              <AlertOutlined style={{ color: '#b91c1c' }} />
              <span style={{ fontWeight: 600 }}>Active Anomalies Queue ({total})</span>
            </Space>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select
                placeholder="All Types"
                allowClear
                style={{ width: 220 }}
                value={selectedType}
                onChange={(v) => {
                  setSelectedType(v)
                  setParams((p) => ({ ...p, page: 1 }))
                }}
                options={[
                  { label: 'COST_OVERRUN', value: 'COST_OVERRUN' },
                  { label: 'DELAYED_PROJECT', value: 'DELAYED_PROJECT' },
                  { label: 'STALLED_PROJECT', value: 'STALLED_PROJECT' },
                  { label: 'DUPLICATE_WORK', value: 'DUPLICATE_WORK' },
                  { label: 'PAYMENT_RISK', value: 'PAYMENT_RISK' },
                  { label: 'COMPLIANCE_RISK', value: 'COMPLIANCE_RISK' },
                  { label: 'DURABILITY_RISK', value: 'DURABILITY_RISK' },
                  { label: 'AMOUNT_CLUSTERING', value: 'AMOUNT_CLUSTERING' },
                  { label: 'END_OF_YEAR_RUSH', value: 'END_OF_YEAR_RUSH' },
                  { label: 'ROUND_NUMBER_BIAS', value: 'ROUND_NUMBER_BIAS' },
                  { label: 'AGENCY_CONCENTRATION', value: 'AGENCY_CONCENTRATION' },
                  { label: 'LOW_UTILIZATION', value: 'LOW_UTILIZATION' },
                  { label: 'OVER_UTILIZATION', value: 'OVER_UTILIZATION' },
                ]}
              />

              <Select
                placeholder="All Severities"
                allowClear
                style={{ width: 140 }}
                value={selectedSeverity}
                onChange={(v) => {
                  setSelectedSeverity(v)
                  setParams((p) => ({ ...p, page: 1 }))
                }}
                options={[
                  { label: 'CRITICAL', value: 'CRITICAL' },
                  { label: 'HIGH', value: 'HIGH' },
                  { label: 'MEDIUM', value: 'MEDIUM' },
                  { label: 'LOW', value: 'LOW' },
                ]}
              />

              <Select
                placeholder="All Statuses"
                allowClear
                style={{ width: 150 }}
                value={selectedStatus}
                onChange={(v) => {
                  setSelectedStatus(v)
                  setParams((p) => ({ ...p, page: 1 }))
                }}
                options={[
                  { label: 'NEW', value: 'NEW' },
                  { label: 'ACKNOWLEDGED', value: 'ACKNOWLEDGED' },
                  { label: 'UNDER_REVIEW', value: 'UNDER_REVIEW' },
                  { label: 'RESOLVED', value: 'RESOLVED' },
                  { label: 'FALSE_POSITIVE', value: 'FALSE_POSITIVE' },
                ]}
              />
            </div>
          </div>
        }
        styles={{ body: { padding: 0 } }}
        style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}
      >
        <Table
          dataSource={anomalies}
          rowKey="id"
          loading={loading}
          pagination={{
            current: params.page,
            pageSize: params.per_page,
            total,
            onChange: (page, pageSize) => setParams({ page, per_page: pageSize }),
            showSizeChanger: true,
          }}
          columns={[
            {
              title: 'Work Ref / Description',
              render: (_: any, r: Anomaly) => (
                <div style={{ cursor: r.work_id ? 'pointer' : 'default' }} onClick={() => r.work_id && handleOpenInvestigation(r)}>
                  <div style={{ fontWeight: 600, color: '#1d4ed8' }}>
                    {r.work_ref || 'Constituency Anomaly'}
                  </div>
                  <Text style={{ color: '#475569', fontSize: '13px' }}>
                    {r.details?.work_description || r.details?.reason || r.details?.message || r.anomaly_type}
                  </Text>
                </div>
              ),
            },
            {
              title: 'Constituency',
              dataIndex: 'constituency_name',
              render: (val: string, r: Anomaly) => (
                <div>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>{val || 'N/A'}</div>
                  <Text style={{ color: '#475569', fontSize: '12px' }}>{r.state}</Text>
                </div>
              ),
            },
            {
              title: 'Type & Category',
              render: (_: any, r: Anomaly) => (
                <div>
                  <Tag color="geekblue">{r.anomaly_type}</Tag>
                  <div style={{ color: '#475569', fontSize: '11px', marginTop: 3 }}>{r.category}</div>
                </div>
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
              render: (val: string) => {
                let color = 'default'
                if (val === 'NEW') color = 'volcano'
                else if (val === 'ACKNOWLEDGED') color = 'gold'
                else if (val === 'UNDER_REVIEW') color = 'purple'
                else if (val === 'RESOLVED') color = 'green'
                else if (val === 'FALSE_POSITIVE') color = 'cyan'
                return <Tag color={color} style={{ fontWeight: 600 }}>{val}</Tag>
              },
            },
            {
              title: 'Actions',
              render: (_: any, record: Anomaly) => (
                <Space size={6}>
                  {record.work_id && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<FileSearchOutlined />}
                      onClick={() => handleOpenInvestigation(record)}
                      style={{ background: '#1d4ed8', borderColor: '#1d4ed8' }}
                    >
                      Dossier
                    </Button>
                  )}
                  <Button
                    size="small"
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenStatusModal(record)}
                    style={{ borderColor: '#cbd5e1', color: '#334155' }}
                  >
                    Transition
                  </Button>
                  <Button
                    size="small"
                    icon={<HistoryOutlined />}
                    onClick={() => handleViewAudit(record)}
                    style={{ borderColor: '#e2e8f0', color: '#475569' }}
                  >
                    Audit
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Investigation Dossier Drawer */}
      <InvestigationDrawer
        open={investigationDrawerOpen}
        onClose={() => setInvestigationDrawerOpen(false)}
        workId={selectedWorkId}
        workRef={selectedWorkRef}
        anomalyId={selectedAnomalyId}
        onStatusChange={loadAnomalies}
      />

      {/* Status Transition Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#15803d' }} />
            <span>Update Anomaly Status</span>
          </Space>
        }
        open={updateModalOpen}
        onCancel={() => setUpdateModalOpen(false)}
        footer={[
          <Button key="back" onClick={() => setUpdateModalOpen(false)}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" loading={updateLoading} onClick={handleUpdateStatus} style={{ background: '#1d4ed8' }}>
            Save Status Transition
          </Button>,
        ]}
      >
        {updatingAnomaly && (
          <Form form={updateForm} layout="vertical" style={{ marginTop: 16 }}>
            <div
              style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 16,
              }}
            >
              <div style={{ color: '#475569', fontSize: '12px' }}>Current Anomaly:</div>
              <div style={{ color: '#0f172a', fontWeight: 600 }}>
                {updatingAnomaly.work_ref || updatingAnomaly.anomaly_type}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <Tag color="orange">Current Status: {updatingAnomaly.status}</Tag>
                <RiskBadge tier={updatingAnomaly.severity} />
              </div>
            </div>

            <Form.Item
              name="status"
              label={<span style={{ fontWeight: 600 }}>New Status</span>}
              rules={[{ required: true, message: 'Please select a status' }]}
            >
              <Select
                options={(VALID_TRANSITIONS[updatingAnomaly.status] || ['RESOLVED', 'FALSE_POSITIVE']).map((s) => ({
                  label: s,
                  value: s,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="note"
              label={<span style={{ fontWeight: 600 }}>Audit Review Note</span>}
              rules={[{ required: true, message: 'Please enter a justification note' }]}
            >
              <TextArea
                rows={3}
                placeholder="Document justification for state audit log (e.g. Field inspection conducted on 2026-08-30 verified duplicate sanction)..."
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Immutable Audit Trail Drawer */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1d4ed8' }} />
            <span>Immutable Audit Trail &bull; {activeAnomalyRef}</span>
          </Space>
        }
        placement="right"
        width={480}
        onClose={() => setAuditDrawerOpen(false)}
        open={auditDrawerOpen}
        styles={{ body: { background: '#f8fafc', padding: '24px' } }}
      >
        {auditLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <Spin tip="Loading Audit Logs..." />
          </div>
        ) : auditItems.length === 0 ? (
          <div style={{ color: '#475569', textAlign: 'center', padding: '30px' }}>
            No status transitions recorded yet for this anomaly.
          </div>
        ) : (
          <Timeline
            style={{ marginTop: 16 }}
            items={auditItems.map((item) => ({
              color: '#1d4ed8',
              children: (
                <div
                  style={{
                    background: '#ffffff',
                    padding: '12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    marginBottom: 12,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#1d4ed8', fontSize: '13px' }}>{item.action}</span>
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: 6 }}>
                    User: <strong style={{ color: '#0f172a' }}>{item.performed_by || 'System'}</strong>
                  </div>

                  {item.new_value?.status && (
                    <div style={{ fontSize: '12px', marginBottom: 6 }}>
                      Transition:{' '}
                      <Tag color="volcano">{item.old_value?.status || 'NEW'}</Tag>
                      &rarr; <Tag color="green">{item.new_value.status}</Tag>
                    </div>
                  )}

                  {item.note && (
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '6px 10px',
                        borderRadius: 6,
                        color: '#334155',
                        fontSize: '12px',
                        fontStyle: 'italic',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      &ldquo;{item.note}&rdquo;
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </Drawer>
    </div>
  )
}

export default AlertManagementPage
