import React, { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  BookOutlined,
  ExperimentOutlined,
  FileProtectOutlined,
  FilterOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import {
  ComplianceAlert,
  ComplianceSummary,
  RulebookItem,
  ScStQuotaItem,
  SimulateWorkPayload,
  SimulateWorkResult,
  fetchComplianceAlerts,
  fetchComplianceRules,
  fetchComplianceSummary,
  fetchScStQuotas,
  rescanCompliance,
  simulateWorkCompliance,
} from '../api/compliance';

const { Title, Text, Paragraph } = Typography;

export const ComplianceMonitoringPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [rules, setRules] = useState<RulebookItem[]>([]);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [quotas, setQuotas] = useState<ScStQuotaItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Simulator State
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<SimulateWorkResult | null>(null);
  const [simForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, rulesData, alertsData, quotasData] = await Promise.all([
        fetchComplianceSummary(),
        fetchComplianceRules(),
        fetchComplianceAlerts(),
        fetchScStQuotas(),
      ]);
      setSummary(sumData);
      setRules(rulesData.rules);
      setAlerts(alertsData.alerts);
      setQuotas(quotasData.quotas);
    } catch (err: any) {
      console.error('Failed to load compliance data', err);
      message.error('Failed to connect to Automated Compliance Engine');
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = async () => {
    setIsRescanning(true);
    try {
      const rescanRes = await rescanCompliance();
      const [rulesData, alertsData, quotasData] = await Promise.all([
        fetchComplianceRules(),
        fetchComplianceAlerts(),
        fetchScStQuotas(),
      ]);
      setSummary(rescanRes.summary);
      setRules(rulesData.rules);
      setAlerts(alertsData.alerts);
      setQuotas(quotasData.quotas);
      message.success(rescanRes.message || 'Compliance Rulebook scan complete!');
    } catch (err: any) {
      console.error('Rescan failed', err);
      message.error('Compliance Rulebook rescan failed');
    } finally {
      setIsRescanning(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSimulate = async (values: any) => {
    setSimLoading(true);
    try {
      const payload: SimulateWorkPayload = {
        work_description: values.work_description,
        work_category: values.work_category,
        sanctioned_amount: values.sanctioned_amount,
        is_sc_area: values.is_sc_area || false,
        is_st_area: values.is_st_area || false,
        annual_cumulative_sanctions: values.annual_cumulative_sanctions || 0,
      };
      const result = await simulateWorkCompliance(payload);
      setSimResult(result);
      if (result.is_compliant) {
        message.success('Sanction Proposal COMPLIANT with MPLADS Guidelines!');
      } else {
        message.warning(`Proposal VIOLATES ${result.rules_violated} Guideline Rules!`);
      }
    } catch (err: any) {
      message.error('Simulation evaluation failed');
    } finally {
      setSimLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSev = severityFilter === 'ALL' || a.severity === severityFilter;
    const matchesSearch =
      !searchQuery ||
      a.work_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.constituency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.guideline_section.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesSearch;
  });

  const getSeverityTag = (sev: string) => {
    switch (sev.toUpperCase()) {
      case 'CRITICAL':
        return <Tag color="error" icon={<WarningOutlined />}>CRITICAL</Tag>;
      case 'HIGH':
        return <Tag color="warning" icon={<AlertOutlined />}>HIGH</Tag>;
      case 'MEDIUM':
        return <Tag color="processing">MEDIUM</Tag>;
      default:
        return <Tag color="default">LOW</Tag>;
    }
  };

  if (loading && !summary) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" tip="Executing Automated Compliance Scanner across 25,000+ works..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 16,
          padding: '24px 32px',
          color: '#ffffff',
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="center" size={12}>
              <SafetyCertificateOutlined style={{ fontSize: 32, color: '#38bdf8' }} />
              <div>
                <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
                  Automated Compliance Monitoring Engine
                </Title>
                <Text style={{ color: '#94a3b8', fontSize: 14 }}>
                  MoSPI MPLADS Scheme Rulebook Scanner & Pre-Sanction Verification Sandbox
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              size="large"
              loading={isRescanning}
              style={{ background: '#0284c7', borderColor: '#0284c7', borderRadius: 8 }}
              onClick={handleRescan}
            >
              {isRescanning ? 'Scanning Rules...' : 'Re-scan Rulebook'}
            </Button>
          </Col>
        </Row>
      </div>

      {/* KPI Cards Row */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <Text type="secondary">Overall Pass Rate</Text>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#059669', margin: '8px 0' }}>
                {summary.compliance_pass_rate_pct}%
              </div>
              <Progress percent={summary.compliance_pass_rate_pct} status="active" strokeColor="#059669" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary.passed_works.toLocaleString()} / {summary.total_works_scanned.toLocaleString()} works compliant
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <Text type="secondary">SC Quota Met (15% Mandate)</Text>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#0284c7', margin: '8px 0' }}>
                {summary.sc_quota_compliance_pct}%
              </div>
              <Progress percent={summary.sc_quota_compliance_pct} strokeColor="#0284c7" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MP Portfolios meeting 15% SC allocation
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <Text type="secondary">ST Quota Met (7.5% Mandate)</Text>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#7c3aed', margin: '8px 0' }}>
                {summary.st_quota_compliance_pct}%
              </div>
              <Progress percent={summary.st_quota_compliance_pct} strokeColor="#7c3aed" />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MP Portfolios meeting 7.5% ST allocation
              </Text>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
              <Text type="secondary">Active Guideline Alerts</Text>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#dc2626', margin: '8px 0' }}>
                {summary.total_active_alerts}
              </div>
              <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                ₹{(summary.total_amount_at_risk / 10000000).toFixed(2)} Cr
              </Text>{' '}
              <Text type="secondary" style={{ fontSize: 12 }}>at audit risk</Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Tabs Component */}
      <Tabs
        defaultActiveKey="alerts"
        type="card"
        size="large"
        items={[
          {
            key: 'alerts',
            label: (
              <span>
                <AlertOutlined /> Violation Alerts Queue ({alerts.length})
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                  <Col>
                    <Space size={12}>
                      <Input
                        placeholder="Search work title, constituency, or rule clause..."
                        prefix={<SearchOutlined />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: 340 }}
                        allowClear
                      />
                      <Radio.Group
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        buttonStyle="solid"
                      >
                        <Radio.Button value="ALL">All Severities</Radio.Button>
                        <Radio.Button value="CRITICAL">Critical</Radio.Button>
                        <Radio.Button value="HIGH">High</Radio.Button>
                        <Radio.Button value="MEDIUM">Medium</Radio.Button>
                      </Radio.Group>
                    </Space>
                  </Col>
                  <Col>
                    <Text type="secondary">Showing {filteredAlerts.length} violation alerts</Text>
                  </Col>
                </Row>

                <Table
                  dataSource={filteredAlerts}
                  rowKey="alert_id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  columns={[
                    {
                      title: 'Guideline Clause',
                      dataIndex: 'guideline_section',
                      key: 'guideline_section',
                      width: 170,
                      render: (val, record) => (
                        <div>
                          <Tag color="purple" style={{ fontWeight: 600 }}>{val}</Tag>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{record.rule_id}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Work Title & Code',
                      dataIndex: 'work_title',
                      key: 'work_title',
                      render: (val, record) => (
                        <div>
                          <Text strong>{val}</Text>
                          <div style={{ fontSize: 12, color: '#0284c7' }}>Code: {record.work_code}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Constituency & MP',
                      dataIndex: 'constituency_name',
                      key: 'constituency_name',
                      render: (val, record) => (
                        <div>
                          <Text>{val} ({record.state})</Text>
                          <div style={{ fontSize: 12, color: '#64748b' }}>MP: {record.mp_name}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Severity',
                      dataIndex: 'severity',
                      key: 'severity',
                      width: 110,
                      render: (sev) => getSeverityTag(sev),
                    },
                    {
                      title: 'Violation Reason',
                      dataIndex: 'violation_details',
                      key: 'violation_details',
                      render: (val, record) => (
                        <div>
                          <Text style={{ fontSize: 13 }}>{val}</Text>
                          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                            <b>Action:</b> {record.suggested_action}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Amount Involve',
                      dataIndex: 'amount_involved',
                      key: 'amount_involved',
                      width: 130,
                      align: 'right',
                      render: (val) => (
                        <Text strong style={{ color: '#dc2626' }}>
                          ₹{(val / 100000).toFixed(2)} Lakh
                        </Text>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'quotas',
            label: (
              <span>
                <SafetyCertificateOutlined /> SC (15%) & ST (7.5%) Quota Tracker
              </span>
            ),
            children: (
              <Card style={{ borderRadius: 12 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Mandatory Allocation Rule (MPLADS Guidelines Section 2.5)"
                  description="MPs must recommend works costing at least 15% of their annual allocation for SC inhabited areas and 7.5% for ST inhabited areas. Below is the real-time compliance tracker across constituency portfolios."
                  style={{ marginBottom: 20 }}
                />

                <Table
                  dataSource={quotas}
                  rowKey="constituency_id"
                  pagination={{ pageSize: 12 }}
                  columns={[
                    {
                      title: 'Constituency & State',
                      dataIndex: 'constituency_name',
                      key: 'constituency_name',
                      render: (val, record) => (
                        <div>
                          <Text strong>{val}</Text>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{record.state}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Hon\'ble MP',
                      dataIndex: 'mp_name',
                      key: 'mp_name',
                    },
                    {
                      title: 'Total Sanctioned Outlay',
                      dataIndex: 'total_sanctioned',
                      key: 'total_sanctioned',
                      align: 'right',
                      render: (val) => `₹${(val / 10000000).toFixed(2)} Cr`,
                    },
                    {
                      title: 'SC Allocation (Min 15%)',
                      key: 'sc_quota',
                      width: 250,
                      render: (_, record) => (
                        <div>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12 }}>{record.sc_percentage}% allocated</Text>
                            {record.sc_compliant ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>MET</Tag>
                            ) : (
                              <Tag color="error">SHORTFALL</Tag>
                            )}
                          </Space>
                          <Progress
                            percent={record.sc_percentage}
                            strokeColor={record.sc_compliant ? '#059669' : '#dc2626'}
                            size="small"
                          />
                        </div>
                      ),
                    },
                    {
                      title: 'ST Allocation (Min 7.5%)',
                      key: 'st_quota',
                      width: 250,
                      render: (_, record) => (
                        <div>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12 }}>{record.st_percentage}% allocated</Text>
                            {record.st_compliant ? (
                              <Tag color="success" icon={<CheckCircleOutlined />}>MET</Tag>
                            ) : (
                              <Tag color="error">SHORTFALL</Tag>
                            )}
                          </Space>
                          <Progress
                            percent={record.st_percentage}
                            strokeColor={record.st_compliant ? '#7c3aed' : '#dc2626'}
                            size="small"
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'rulebook',
            label: (
              <span>
                <BookOutlined /> Machine-Readable Rulebook ({rules.length})
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {rules.map((rule) => (
                  <Col xs={24} md={12} key={rule.id}>
                    <Card
                      style={{
                        borderRadius: 12,
                        height: '100%',
                        borderLeft: `5px solid ${
                          rule.severity === 'CRITICAL' ? '#dc2626' : rule.severity === 'HIGH' ? '#f59e0b' : '#3b82f6'
                        }`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
                        <Tag color="purple" style={{ fontWeight: 700 }}>{rule.guideline_section}</Tag>
                        {getSeverityTag(rule.severity)}
                      </div>

                      <Title level={4} style={{ margin: '8px 0', fontSize: 16 }}>
                        {rule.name} <Text type="secondary" style={{ fontSize: 12 }}>({rule.id})</Text>
                      </Title>

                      <Paragraph style={{ color: '#475569', fontSize: 13 }}>
                        {rule.description}
                      </Paragraph>

                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
                        <Text strong style={{ color: '#0f172a' }}>Logic Condition: </Text>
                        <Text code>{rule.condition}</Text>
                      </div>

                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text type="secondary" style={{ fontSize: 12 }}>Active Violations: </Text>
                          <Badge count={rule.violations_detected} overflowCount={9999} showZero />
                        </Col>
                        <Col>
                          <Tag color={rule.status === 'PASSED' ? 'success' : 'error'}>
                            {rule.status}
                          </Tag>
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'simulator',
            label: (
              <span>
                <ExperimentOutlined /> Pre-Sanction Rule Simulator
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                  <Card title="Pre-Sanction Compliance Sandbox" style={{ borderRadius: 12 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                      Test a proposed work payload against the MPLADS Rules Engine before issuing formal administrative sanction.
                    </Text>

                    <Form form={simForm} layout="vertical" onFinish={handleSimulate} initialValues={{ sanctioned_amount: 1500000, work_category: 'Community Infrastructure' }}>
                      <Form.Item
                        name="work_description"
                        label="Work Proposal Description"
                        rules={[{ required: true, message: 'Please enter work description' }]}
                      >
                        <Input.TextArea rows={3} placeholder="e.g. Construction of SC Community Hall in Ward 14" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="work_category" label="Work Category">
                            <Select>
                              <Select.Option value="Community Infrastructure">Community Infrastructure</Select.Option>
                              <Select.Option value="Drinking Water">Drinking Water Facilities</Select.Option>
                              <Select.Option value="Education & Schools">Education & Schools</Select.Option>
                              <Select.Option value="Public Health & Sanitation">Public Health & Sanitation</Select.Option>
                              <Select.Option value="Office Vehicle & Transport">Office Vehicle & Transport (Banned Test)</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="sanctioned_amount"
                            label="Proposed Cost (₹)"
                            rules={[{ required: true, message: 'Please enter cost' }]}
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value!.replace(/\₹\s?|(,*)/g, '') as any}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="is_sc_area" label="SC Habitation Area?" valuePropName="checked">
                            <Switch checkedChildren="YES (15% Credit)" unCheckedChildren="NO" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="is_st_area" label="ST Habitation Area?" valuePropName="checked">
                            <Switch checkedChildren="YES (7.5% Credit)" unCheckedChildren="NO" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item name="annual_cumulative_sanctions" label="Current FY Cumulative Sanctions for MP (₹)">
                        <InputNumber
                          style={{ width: '100%' }}
                          formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value!.replace(/\₹\s?|(,*)/g, '') as any}
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={simLoading} block size="large">
                          Run Pre-Sanction Rule Evaluation
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card title="Rule Engine Verdict & Audit Evaluation" style={{ borderRadius: 12, height: '100%' }}>
                    {simResult ? (
                      <div>
                        <Alert
                          type={simResult.is_compliant ? 'success' : 'error'}
                          showIcon
                          message={<span style={{ fontSize: 18, fontWeight: 700 }}>{simResult.verdict}</span>}
                          description={`Evaluated ${simResult.total_rules_checked} machine-readable rules: ${simResult.rules_passed} passed, ${simResult.rules_violated} violated.`}
                          style={{ marginBottom: 20 }}
                        />

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                          <Text strong>Quota Credit Status: </Text>
                          <Tag color="blue">{simResult.sc_st_credit}</Tag>
                        </div>

                        {simResult.violations.length > 0 && (
                          <div>
                            <Title level={5} style={{ color: '#dc2626' }}>Violated Guideline Clauses:</Title>
                            {simResult.violations.map((v, idx) => (
                              <Card key={idx} size="small" style={{ marginBottom: 12, borderLeft: '4px solid #dc2626' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                  <Text strong>{v.name} ({v.rule_id})</Text>
                                  <Tag color="purple">{v.guideline_section}</Tag>
                                </div>
                                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
                                  <b>Reason:</b> {v.reason}
                                </div>
                                <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                  <b>Required Action:</b> {v.action}
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                        <ExperimentOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                        <Title level={4} style={{ color: '#64748b' }}>No Simulation Evaluated Yet</Title>
                        <Paragraph type="secondary">
                          Fill in the proposal form on the left and click "Run Pre-Sanction Rule Evaluation" to test against the MPLADS Rulebook.
                        </Paragraph>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};
