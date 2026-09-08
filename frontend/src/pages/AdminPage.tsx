import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Form,
  InputNumber,
  Slider,
  Button,
  Upload,
  message,
  Table,
  Tag,
  Space,
  Progress,
  Divider,
  Modal,
} from 'antd'
import {
  InboxOutlined,
  PlayCircleOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { adminApi, SyntheticParams } from '../api/admin'
import { DetectionRun, UploadHistoryItem } from '../types'

const { Title, Text, Paragraph } = Typography
const { Dragger } = Upload

export const AdminPage: React.FC = () => {
  const [synthForm] = Form.useForm()
  const [synthLoading, setSynthLoading] = useState(false)
  const [detectLoading, setDetectLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [activeRun, setActiveRun] = useState<DetectionRun | null>(null)
  const [runs, setRuns] = useState<DetectionRun[]>([])
  const [uploads, setUploads] = useState<UploadHistoryItem[]>([])
  const [uploadResult, setUploadResult] = useState<any>(null)

  const handleResetAllDataToZero = () => {
    Modal.confirm({
      title: 'Reset Entire Project to Zero (Clear All Data)?',
      icon: <DeleteOutlined style={{ color: '#ef4444' }} />,
      content:
        'This will completely wipe all works, fund releases, anomalies, and history across the entire project, setting all metrics to ZERO. After resetting, you can upload your official dataset to drive all project visuals directly from the uploaded file.',
      okText: 'Confirm Reset to Zero',
      okType: 'danger',
      cancelText: 'Cancel',
      okButtonProps: { style: { background: '#dc2626', borderColor: '#dc2626' } },
      onOk: async () => {
        try {
          setResetLoading(true)
          const res = await adminApi.resetDefault()
          message.success(res.message || 'Database completely reset to zero. All metrics cleared!')
          setRuns([])
          setUploads([])
          setActiveRun(null)
          setUploadResult(null)
          loadHistory()
        } catch (err: any) {
          console.error(err)
          message.error(err.response?.data?.detail?.message || 'Failed to reset database')
        } finally {
          setResetLoading(false)
        }
      },
    })
  }

  const handleResetSynthetic = () => {
    synthForm.resetFields()
    message.info('Synthetic generator form reset to defaults.')
  }

  useEffect(() => {
    loadHistory()
  }, [])

  // Timer for active detection run
  useEffect(() => {
    let timer: any = null
    if (detectLoading) {
      setElapsedSeconds(0)
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [detectLoading])

  // Compute average duration from previous completed runs or fallback to 8s
  const getEstimatedTotalSeconds = () => {
    const completedRuns = runs.filter(
      (r) => r.status === 'COMPLETED' && r.started_at && r.completed_at
    )
    if (completedRuns.length > 0) {
      const totalSecs = completedRuns.slice(0, 5).reduce((acc, r) => {
        const diff = (new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime()) / 1000
        return acc + Math.max(diff, 4)
      }, 0)
      return Math.round(totalSecs / Math.min(completedRuns.length, 5))
    }
    return 8
  }

  const estimatedTotalSeconds = getEstimatedTotalSeconds()
  const estimatedRemaining = Math.max(1, estimatedTotalSeconds - elapsedSeconds)
  const progressPercent = Math.min(95, Math.max(5, Math.round((elapsedSeconds / Math.max(estimatedTotalSeconds, 1)) * 90)))

  const getStageDescription = () => {
    const ratio = elapsedSeconds / Math.max(estimatedTotalSeconds, 1)
    if (ratio < 0.2) return 'Stage 1/5: Cost Overrun & Outlier Analysis (Z-Score + IsoForest)'
    if (ratio < 0.4) return 'Stage 2/5: Milestone & Delay Classifier (90/180/365 Tiering)'
    if (ratio < 0.6) return 'Stage 3/5: Semantic NLP Duplicate Detector (MiniLM-L6-v2)'
    if (ratio < 0.8) return 'Stage 4/5: Pattern Clustering & Year-End Surge Analysis'
    return 'Stage 5/5: Multi-Criteria Composite Risk Index Aggregation'
  }

  const loadHistory = async () => {
    try {
      const [runsData, uploadsData] = await Promise.all([
        adminApi.getDetectionHistory(),
        adminApi.getUploadHistory(),
      ])
      const runsList = Array.isArray(runsData) ? runsData : (runsData as any)?.data || []
      const uploadsList = Array.isArray(uploadsData) ? uploadsData : (uploadsData as any)?.data || []
      setRuns(runsList)
      setUploads(uploadsList)

      // Check if any run is active
      const running = runsList.find((r: any) => r.status === 'RUNNING')
      if (running) {
        setActiveRun(running)
        setDetectLoading(true)
        pollActiveRun()
      }
    } catch (err) {
      console.error('Failed to load admin history', err)
    }
  }

  const pollActiveRun = () => {
    const interval = setInterval(async () => {
      try {
        const historyRes = await adminApi.getDetectionHistory()
        const history = Array.isArray(historyRes) ? historyRes : (historyRes as any)?.data || []
        setRuns(history)
        const current = history[0]
        if (current && current.status !== 'RUNNING') {
          setActiveRun(current)
          setDetectLoading(false)
          clearInterval(interval)
          if (current.status === 'COMPLETED') {
            message.success(`Pipeline completed! ${current.anomalies_detected} anomalies detected.`)
          } else {
            message.error(`Pipeline failed: ${current.error_message}`)
          }
        }
      } catch {
        clearInterval(interval)
        setDetectLoading(false)
      }
    }, 1500)
  }

  const handleGenerateSynthetic = async (values: any) => {
    try {
      setSynthLoading(true)
      const params: SyntheticParams = {
        num_constituencies: values.num_constituencies,
        num_works_per_constituency: values.num_works_per_constituency,
        anomaly_injection_rate: values.anomaly_injection_rate / 100,
        seed: values.seed || 42,
      }
      const res = await adminApi.generateSynthetic(params)
      message.success(
        `Generated ${res.works || res.works_created || (params.num_constituencies * params.num_works_per_constituency)} works across ${params.num_constituencies} constituencies!`
      )
      loadHistory()
      pollActiveRun()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.detail?.message || 'Failed to generate synthetic data')
    } finally {
      setSynthLoading(false)
    }
  }

  const handleTriggerDetection = async () => {
    try {
      setDetectLoading(true)
      const res = await adminApi.triggerDetection()
      message.info(res.message || 'Detection pipeline started in background.')
      loadHistory()
      pollActiveRun()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.detail?.message || 'Failed to start detection pipeline')
      setDetectLoading(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      const res = await adminApi.uploadFile(file)
      setUploadResult(res)
      message.success(`Uploaded ${file.name}: ${res.records_valid} valid records ingested.`)
      loadHistory()
    } catch (err: any) {
      console.error(err)
      const detail = err.response?.data?.detail
      const baseMsg = typeof detail === 'string' ? detail : (detail?.message || 'Upload failed validation')
      const firstErr = Array.isArray(detail?.details) && detail.details.length > 0
        ? (detail.details[0].error_message || JSON.stringify(detail.details[0]))
        : null
      message.error(firstErr ? `${baseMsg}: ${firstErr}` : baseMsg, 6)
    }
    return false // prevent default upload
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={3} style={{ color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
            System Administration & AI Pipelines
          </Title>
          <Text style={{ color: '#475569', fontSize: '13px' }}>
            Manage official 543 Lok Sabha dataset synchronization, ingest CSV records, and orchestrate ML detection pipelines
          </Text>
        </div>

        <Space>
          <Button
            type="primary"
            danger
            icon={<DeleteOutlined />}
            loading={resetLoading}
            onClick={handleResetAllDataToZero}
            style={{
              background: '#dc2626',
              borderColor: '#dc2626',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 8,
              height: 38,
            }}
          >
            Reset All Data (Clear to Zero)
          </Button>
        </Space>
      </div>

      <Row gutter={[20, 20]}>
        {/* Detection Pipeline Orchestrator */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#1d4ed8' }} />
                <span>AI Anomaly Detection Pipeline</span>
              </Space>
            }
            bodyStyle={{ padding: 24 }}
          >
            <Paragraph style={{ color: '#475569', fontSize: '13px' }}>
              Triggers the end-to-end multi-detector pipeline across all active works:
            </Paragraph>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>1. Cost Overruns</div>
                <div style={{ color: '#475569', fontSize: '11px' }}>Z-score + IsoForest</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#ea580c', fontWeight: 600, fontSize: '12px' }}>2. Delays / Stalled</div>
                <div style={{ color: '#475569', fontSize: '11px' }}>90/180/365 Tiering</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#9333ea', fontWeight: 600, fontSize: '12px' }}>3. Duplicates</div>
                <div style={{ color: '#475569', fontSize: '11px' }}>MiniLM + Jaccard</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#ca8a04', fontWeight: 600, fontSize: '12px' }}>4. Suspicious Patterns</div>
                <div style={{ color: '#475569', fontSize: '11px' }}>Clustering & Rush</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '12px' }}>5. Fund Utilization</div>
                <div style={{ color: '#475569', fontSize: '11px' }}>Per-State Normalization</div>
              </div>
            </div>

            {/* Estimated Completion Time Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#eff6ff',
                borderRadius: 8,
                border: '1px solid #bfdbfe',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e40af', fontSize: '12px' }}>
                <ClockCircleOutlined style={{ color: '#2563eb', fontSize: '14px' }} />
                <span>
                  <strong>Est. Completion Time:</strong> ~{estimatedTotalSeconds}s (~1,000+ active works across 5 ML detectors)
                </span>
              </div>
              <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>Fast Engine</Tag>
            </div>

            {detectLoading && (
              <div
                style={{
                  background: '#f0fdf4',
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: '1px solid #bbf7d0',
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534' }}>
                    <SyncOutlined spin />
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>AI Detection Pipeline In Progress...</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>
                    Elapsed: {elapsedSeconds}s | Est. Remaining: ~{estimatedRemaining}s
                  </div>
                </div>
                <Progress
                  percent={progressPercent}
                  status="active"
                  strokeColor={{ from: '#3b82f6', to: '#10b981' }}
                  showInfo={false}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#10b981' }}>●</span> {getStageDescription()}
                </div>
              </div>
            )}

            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              loading={detectLoading}
              onClick={handleTriggerDetection}
              block
              style={{
                height: 44,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                fontWeight: 600,
                borderRadius: 8,
              }}
            >
              Run Full Detection Pipeline
            </Button>
          </Card>
        </Col>

        {/* Synthetic Generator */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DatabaseOutlined style={{ color: '#10b981' }} />
                <span>Synthetic Data Generator (Benchmarking)</span>
              </Space>
            }
            bodyStyle={{ padding: 24 }}
          >
            <Form
              form={synthForm}
              layout="vertical"
              initialValues={{
                num_constituencies: 50,
                num_works_per_constituency: 100,
                anomaly_injection_rate: 8,
                seed: Math.floor(Math.random() * 10000),
              }}
              onFinish={handleGenerateSynthetic}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="num_constituencies" label={<span style={{ color: '#334155' }}>Constituencies (1 - 543)</span>}>
                    <InputNumber min={1} max={543} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item name="num_works_per_constituency" label={<span style={{ color: '#334155' }}>Works per Constituency</span>}>
                    <InputNumber min={1} max={500} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="anomaly_injection_rate"
                label={<span style={{ color: '#334155' }}>Anomaly Injection Rate (%)</span>}
              >
                <Slider min={0} max={50} marks={{ 0: '0%', 8: '8%', 25: '25%', 50: '50%' }} />
              </Form.Item>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={synthLoading}
                  style={{
                    flex: 1,
                    height: 40,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    fontWeight: 600,
                    borderRadius: 8,
                  }}
                >
                  Generate & Ingest Dataset
                </Button>
                <Button
                  onClick={handleResetSynthetic}
                  style={{
                    height: 40,
                    borderRadius: 8,
                  }}
                >
                  Reset Defaults
                </Button>
              </div>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* CSV / XLSX Data Ingestion Section */}
      <Card
        title={
          <Space>
            <InboxOutlined style={{ color: '#9333ea' }} />
            <span>Official CSV / XLSX Dataset Ingestion (FR-DIM-001)</span>
          </Space>
        }
        bodyStyle={{ padding: 24 }}
      >
        <Dragger
          name="file"
          multiple={false}
          accept=".csv,.xlsx"
          beforeUpload={handleFileUpload}
          style={{
            background: '#f8fafc',
            borderColor: '#cbd5e1',
            borderRadius: 12,
            padding: '24px',
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#2563eb', fontSize: 44 }} />
          </p>
          <p style={{ color: '#0f172a', fontSize: '15px', fontWeight: 600, margin: '8px 0 4px 0' }}>
            Click or drag official dataset file here to upload
          </p>
          <p style={{ color: '#475569', fontSize: '13px' }}>
            Supports Sanctioned Works or Fund Releases schemas (.csv or .xlsx). Strict per-row validation is applied.
          </p>
        </Dragger>

        {uploadResult && (
          <div
            style={{
              marginTop: 16,
              background: '#f8fafc',
              padding: '16px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>Ingestion Summary</span>
              <Tag color="green">Upload ID: {uploadResult.upload_id}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: '13px' }}>
              <div>Total Parsed: <strong style={{ color: '#0f172a' }}>{uploadResult.records_parsed}</strong></div>
              <div>Valid Ingested: <strong style={{ color: '#059669' }}>{uploadResult.records_valid}</strong></div>
              <div>Rejected: <strong style={{ color: '#dc2626' }}>{uploadResult.records_rejected}</strong></div>
            </div>

            {uploadResult.validation_errors?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
                  Validation Errors (First {uploadResult.validation_errors.length}):
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {uploadResult.validation_errors.map((err: any, idx: number) => (
                    <div key={idx} style={{ color: '#475569', fontSize: '12px', padding: '2px 0' }}>
                      Row {err.row_number} [{err.column}]: {err.error_message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Detection Run History */}
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ color: '#3b82f6' }} />
            <span>Detection Pipeline Execution History</span>
          </Space>
        }
        bodyStyle={{ padding: 0 }}
      >
        <Table
          dataSource={runs}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            {
              title: 'Run ID',
              dataIndex: 'id',
              render: (val: string) => <span style={{ color: '#3b82f6', fontWeight: 600 }}>{val.substring(0, 8)}...</span>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (val: string) => (
                <Tag
                  icon={val === 'COMPLETED' ? <CheckCircleOutlined /> : val === 'RUNNING' ? <SyncOutlined spin /> : <CloseCircleOutlined />}
                  color={val === 'COMPLETED' ? 'green' : val === 'RUNNING' ? 'blue' : 'red'}
                >
                  {val}
                </Tag>
              ),
            },
            {
              title: 'Trigger Type',
              dataIndex: 'trigger_type',
              render: (val: string) => <Tag>{val}</Tag>,
            },
            {
              title: 'Works Analyzed',
              dataIndex: 'works_analyzed',
              render: (val: number) => <span style={{ fontWeight: 600 }}>{val || 0}</span>,
            },
            {
              title: 'Anomalies Detected',
              dataIndex: 'anomalies_detected',
              render: (val: number) => (
                <span style={{ color: '#ef4444', fontWeight: 700 }}>{val || 0}</span>
              ),
            },
            {
              title: 'Duration',
              key: 'duration',
              render: (_: any, record: DetectionRun) => {
                if (record.status === 'RUNNING') {
                  return <Tag color="processing">Running...</Tag>
                }
                if (!record.completed_at || !record.started_at) {
                  return <span style={{ color: '#475569' }}>-</span>
                }
                const diffMs = new Date(record.completed_at).getTime() - new Date(record.started_at).getTime()
                const secs = (diffMs / 1000).toFixed(1)
                return <span style={{ color: '#38bdf8', fontWeight: 600 }}>{secs}s</span>
              },
            },
            {
              title: 'Started At',
              dataIndex: 'started_at',
              render: (val: string) => new Date(val).toLocaleString(),
            },
            {
              title: 'Completed At',
              dataIndex: 'completed_at',
              render: (val: string | null) => (val ? new Date(val).toLocaleString() : 'In Progress'),
            },
          ]}
        />
      </Card>
    </div>
  )
}
