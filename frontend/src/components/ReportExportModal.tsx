import React, { useState } from 'react'
import { Modal, Form, Select, Radio, Button, message, Space } from 'antd'
import { FilePdfOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons'
import { reportsApi, ReportRequest } from '../api/reports'

interface ReportExportModalProps {
  open: boolean
  onClose: () => void
  defaultScope?: 'NATIONAL' | 'STATE' | 'CONSTITUENCY'
  defaultScopeId?: string
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  open,
  onClose,
  defaultScope = 'NATIONAL',
  defaultScopeId,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const payload: ReportRequest = {
        scope: values.scope,
        scope_id: values.scope_id || defaultScopeId || undefined,
        financial_year: values.financial_year || 'ALL',
        format: values.format,
      }

      const res = await reportsApi.generateReport(payload)
      const ext = values.format.toLowerCase()
      const fname = `PRAHAR_${values.scope}_Report_${Date.now()}.${ext}`
      await reportsApi.downloadReport(res.download_url, fname)

      message.success(`Report downloaded successfully: ${fname}`)
      onClose()
    } catch (err: any) {
      console.error(err)
      message.error(err.response?.data?.detail?.message || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined style={{ color: '#1d4ed8' }} />
          <span>Export Executive Audit Report</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleExport} style={{ background: '#1d4ed8' }}>
          Generate & Download
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          scope: defaultScope,
          scope_id: defaultScopeId,
          financial_year: 'ALL',
          format: 'PDF',
        }}
        style={{ marginTop: 16 }}
      >
        <Form.Item name="scope" label={<span style={{ color: '#334155' }}>Report Scope</span>}>
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="NATIONAL">National</Radio.Button>
            <Radio.Button value="STATE">State</Radio.Button>
            <Radio.Button value="CONSTITUENCY">Constituency</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.scope !== curr.scope}
        >
          {({ getFieldValue }) =>
            getFieldValue('scope') === 'STATE' ? (
              <Form.Item
                name="scope_id"
                label={<span style={{ color: '#334155' }}>Select State</span>}
                rules={[{ required: true, message: 'Please select a state' }]}
                initialValue="Maharashtra"
              >
                <Select
                  options={[
                    { label: 'Maharashtra', value: 'Maharashtra' },
                    { label: 'Gujarat', value: 'Gujarat' },
                    { label: 'Karnataka', value: 'Karnataka' },
                    { label: 'Uttar Pradesh', value: 'Uttar Pradesh' },
                    { label: 'Madhya Pradesh', value: 'Madhya Pradesh' },
                    { label: 'Rajasthan', value: 'Rajasthan' },
                    { label: 'West Bengal', value: 'West Bengal' },
                    { label: 'Tamil Nadu', value: 'Tamil Nadu' },
                    { label: 'Bihar', value: 'Bihar' },
                    { label: 'Kerala', value: 'Kerala' },
                    { label: 'Delhi', value: 'Delhi' },
                    { label: 'Odisha', value: 'Odisha' },
                    { label: 'Telangana', value: 'Telangana' },
                    { label: 'Punjab', value: 'Punjab' },
                  ]}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item name="financial_year" label={<span style={{ color: '#334155' }}>Financial Year</span>}>
          <Select
            options={[
              { label: 'All Financial Years', value: 'ALL' },
              { label: '2026-27', value: '2026-27' },
              { label: '2025-26', value: '2025-26' },
              { label: '2024-25', value: '2024-25' },
              { label: '2023-24', value: '2023-24' },
            ]}
          />
        </Form.Item>

        <Form.Item name="format" label={<span style={{ color: '#334155' }}>Export Format</span>}>
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="PDF">
                <Space>
                  <FilePdfOutlined style={{ color: '#dc2626', fontSize: '16px' }} />
                  <span style={{ color: '#0f172a' }}>PDF Executive Report (Includes charts, top-20 risk tables & methodology)</span>
                </Space>
              </Radio>
              <Radio value="CSV">
                <Space>
                  <FileExcelOutlined style={{ color: '#16a34a', fontSize: '16px' }} />
                  <span style={{ color: '#0f172a' }}>CSV Raw Dataset (Full work-level and anomaly details for spreadsheets)</span>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Modal>
  )
}
