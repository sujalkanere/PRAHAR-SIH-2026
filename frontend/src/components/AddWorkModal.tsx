import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  message,
  Row,
  Col,
  Space,
  Divider,
} from 'antd'
import { PlusCircleOutlined, BuildOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { worksApi, CreateWorkPayload } from '../api/works'
import { constituenciesApi } from '../api/constituencies'
import { ConstituencySummary } from '../types'

interface AddWorkModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  defaultConstituencyId?: string
}

export const AddWorkModal: React.FC<AddWorkModalProps> = ({
  open,
  onClose,
  onSuccess,
  defaultConstituencyId,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [constituencies, setConstituencies] = useState<ConstituencySummary[]>([])
  const [fetchingConst, setFetchingConst] = useState(false)

  useEffect(() => {
    if (open) {
      loadConstituencies()
      if (defaultConstituencyId) {
        form.setFieldsValue({ constituency_id: defaultConstituencyId })
      }
    }
  }, [open, defaultConstituencyId])

  const loadConstituencies = async () => {
    try {
      setFetchingConst(true)
      const res = await constituenciesApi.list()
      setConstituencies(res.data || [])
    } catch (err) {
      console.error('Failed to load constituencies for dropdown', err)
    } finally {
      setFetchingConst(false)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const payload: CreateWorkPayload = {
        constituency_id: values.constituency_id,
        work_description: values.work_description,
        work_category: values.work_category,
        sanctioned_amount: values.sanctioned_amount,
        actual_expenditure: values.actual_expenditure || 0,
        sanction_date: values.sanction_date.format('YYYY-MM-DD'),
        expected_completion_date: values.expected_completion_date
          ? values.expected_completion_date.format('YYYY-MM-DD')
          : undefined,
        completion_date: values.completion_date
          ? values.completion_date.format('YYYY-MM-DD')
          : undefined,
        work_status: values.work_status || 'SANCTIONED',
        implementing_agency: values.implementing_agency || 'District Authority',
        financial_year: values.financial_year || '2024-25',
      }

      const created = await worksApi.create(payload)
      message.success(`Work project ${created.work_id || 'entry'} added and indexed successfully!`)
      form.resetFields()
      onClose()
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      console.error(err)
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : detail?.message || 'Failed to create work entry'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <PlusCircleOutlined style={{ color: '#10b981' }} />
          <span>Add New Sanctioned Work Project</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button
          key="cancel"
          onClick={onClose}
        >
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontWeight: 600 }}
        >
          Create & Synchronize Entry
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          work_category: 'ROADS',
          work_status: 'SANCTIONED',
          financial_year: '2024-25',
          sanction_date: dayjs(),
          expected_completion_date: dayjs().add(6, 'month'),
          implementing_agency: 'Public Works Department (PWD)',
        }}
        style={{ marginTop: 16 }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="constituency_id"
              label={<span style={{ color: '#334155' }}>Parliamentary Constituency</span>}
              rules={[{ required: true, message: 'Please select a constituency' }]}
            >
              <Select
                showSearch
                loading={fetchingConst}
                placeholder="Search and select from 543 Lok Sabha Constituencies"
                optionFilterProp="label"
                options={constituencies.map((c) => ({
                  label: `${c.name} (${c.state}) - MP: ${c.mp_name || 'N/A'}`,
                  value: c.id,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="work_category"
              label={<span style={{ color: '#334155' }}>Infrastructure Sector / Category</span>}
              rules={[{ required: true, message: 'Please select category' }]}
            >
              <Select
                options={[
                  { label: 'Roads & Bridges (ROADS)', value: 'ROADS' },
                  { label: 'Drinking Water & Borewells (DRINKING_WATER)', value: 'DRINKING_WATER' },
                  { label: 'Healthcare & PHCs (HEALTH)', value: 'HEALTH' },
                  { label: 'Education & Classrooms (EDUCATION)', value: 'EDUCATION' },
                  { label: 'Sanitation & Drainage (SANITATION)', value: 'SANITATION' },
                  { label: 'Power & Solar Lighting (POWER)', value: 'POWER' },
                  { label: 'Irrigation & Flood Control (IRRIGATION)', value: 'IRRIGATION' },
                  { label: 'Community & Panchayat Halls (COMMUNITY)', value: 'COMMUNITY' },
                  { label: 'Sports & Youth Complex (SPORTS)', value: 'SPORTS' },
                  { label: 'Other Public Infrastructure (OTHER)', value: 'OTHER' },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="financial_year"
              label={<span style={{ color: '#334155' }}>Financial Year</span>}
              rules={[{ required: true, message: 'Please select financial year' }]}
            >
              <Select
                options={[
                  { label: '2024-25', value: '2024-25' },
                  { label: '2025-26', value: '2025-26' },
                  { label: '2023-24', value: '2023-24' },
                  { label: '2022-23', value: '2022-23' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="work_description"
          label={<span style={{ color: '#334155' }}>Work Project Description</span>}
          rules={[
            { required: true, message: 'Please provide work description' },
            { min: 5, message: 'Description must be at least 5 characters' },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. Construction of 500m Cement Concrete road with side drainage in Gram Panchayat Ward 4"
            showCount
            maxLength={500}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="sanctioned_amount"
              label={<span style={{ color: '#334155' }}>Sanctioned Amount (₹)</span>}
              rules={[{ required: true, message: 'Please enter sanctioned amount' }]}
            >
              <InputNumber
                min={1000}
                style={{ width: '100%' }}
                formatter={(val) => `₹ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val: any) => val.replace(/₹\s?|(,*)/g, '')}
                placeholder="e.g. 1500000"
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="actual_expenditure"
              label={<span style={{ color: '#334155' }}>Actual Expenditure (₹)</span>}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={(val) => `₹ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val: any) => val.replace(/₹\s?|(,*)/g, '')}
                placeholder="e.g. 0 or amount spent"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="sanction_date"
              label={<span style={{ color: '#334155' }}>Sanction Date</span>}
              rules={[{ required: true, message: 'Please pick sanction date' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="expected_completion_date"
              label={<span style={{ color: '#334155' }}>Expected Completion Date</span>}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="work_status"
              label={<span style={{ color: '#334155' }}>Project Status</span>}
            >
              <Select
                options={[
                  { label: 'Sanctioned / Approved', value: 'SANCTIONED' },
                  { label: 'In Progress (Ongoing)', value: 'IN_PROGRESS' },
                  { label: 'Completed (Executed)', value: 'COMPLETED' },
                  { label: 'On Hold (Stalled)', value: 'ON_HOLD' },
                  { label: 'Cancelled', value: 'CANCELLED' },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              name="implementing_agency"
              label={<span style={{ color: '#334155' }}>Implementing Agency</span>}
            >
              <Input placeholder="e.g. Public Works Department (PWD)" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
