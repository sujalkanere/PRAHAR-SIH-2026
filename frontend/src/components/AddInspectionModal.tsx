import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, DatePicker, Select, Button, message, AutoComplete, Space, Typography } from 'antd'
import { complianceApi } from '../api/compliance'

const { TextArea } = Input
const { Text } = Typography

interface Props {
  open: boolean
  onClose: () => void
  workId?: string // If null, allow user to input or we just assume it's opened from a specific work context
}

const OFFICIAL_PROJECT_SUGGESTIONS = [
  { value: 'RW-303916', label: 'RW-303916 • CC Road from Sona Traders to Tohfiq Saheb (Nanded, Maharashtra)' },
  { value: 'RW-303918', label: 'RW-303918 • CC Drainage in Bajrang Colony (Nanded, Maharashtra)' },
  { value: 'RW-311247', label: 'RW-311247 • Tangla Dimakuchi Road improvement (Udalguri, Assam)' },
  { value: 'RW-311249', label: 'RW-311249 • Assembly Hall at Sauraguri (Tamulpur, Assam)' },
  { value: 'RW-311251', label: 'RW-311251 • Solar Drinking Water at Monipur (Baksa, Assam)' },
  { value: 'RW-311324', label: 'RW-311324 • Park Development at Coffee Board (Bengaluru Urban, Karnataka)' },
  { value: 'RW-311350', label: 'RW-311350 • Drainage System at Dugdha Village (Mayurbhanj, Odisha)' },
  { value: 'RW-311395', label: 'RW-311395 • Sports Infrastructure in Govt Schools (Chennai, Tamil Nadu)' },
  { value: 'RW-311433', label: 'RW-311433 • CC Road to Gottimukkala Boji House (West Godavari, Andhra Pradesh)' },
  { value: 'RW-304010', label: 'RW-304010 • Smart Class at Samarpada Primary School (Narmada, Gujarat)' },
  { value: 'CW-266550', label: 'CW-266550 • Classroom Building at Govt High School Nidle (Dakshina Kannada, Karnataka)' },
  { value: 'CW-295104', label: 'CW-295104 • Classrooms at Nidle Govt High School (Dakshina Kannada, Karnataka)' },
]

export const AddInspectionModal: React.FC<Props> = ({ open, onClose, workId }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      if (workId) {
        form.setFieldsValue({ work_id: workId, inspection_outcome: 'SATISFACTORY' })
      } else {
        form.setFieldsValue({ work_id: 'RW-303916', inspection_outcome: 'SATISFACTORY' })
      }
    }
  }, [open, workId, form])

  const handleFinish = async (values: any) => {
    if (!values.work_id) {
      message.error("Official Work ID is required (e.g. RW-303916)")
      return
    }
    setLoading(true)
    try {
      await complianceApi.createInspection({
        work_id: values.work_id.trim(),
        inspection_date: values.inspection_date.format('YYYY-MM-DD'),
        inspection_outcome: values.inspection_outcome,
        notes: values.notes,
        photo_reference: values.photo_reference,
      })
      message.success(`Physical inspection logged successfully for ${values.work_id.trim()}`)
      form.resetFields()
      onClose()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to log inspection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Log Physical Inspection</span>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>(MoSPI Official Work Registry)</Text>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ work_id: workId || 'RW-303916', inspection_outcome: 'SATISFACTORY' }}
      >
        <Form.Item
          label={<span style={{ fontWeight: 600 }}>Official Work ID (e.g. RW-303916)</span>}
          name="work_id"
          rules={[{ required: true, message: 'Please enter or select an official Work ID (e.g. RW-303916)' }]}
          extra="Enter or select the official statutory Work ID from the dataset (e.g. RW-303916). Database internal UUIDs are not required."
        >
          <AutoComplete
            options={OFFICIAL_PROJECT_SUGGESTIONS}
            placeholder="Search or enter official Work ID (e.g., RW-303916)"
            filterOption={(inputValue, option) =>
              (option?.label ?? '').toLowerCase().includes(inputValue.toLowerCase()) ||
              (option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase())
            }
            allowClear
            disabled={!!workId}
          />
        </Form.Item>

        <Form.Item
          label={<span style={{ fontWeight: 600 }}>Inspection Date</span>}
          name="inspection_date"
          rules={[{ required: true, message: 'Please select date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label={<span style={{ fontWeight: 600 }}>Inspection Outcome</span>}
          name="inspection_outcome"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="SATISFACTORY">Satisfactory (Statutory Standards Met)</Select.Option>
            <Select.Option value="MINOR_ISSUES">Minor Issues / Snags</Select.Option>
            <Select.Option value="MAJOR_ISSUES">Major Defects / Quality Failure</Select.Option>
            <Select.Option value="ASSET_FAILURE">Total Asset Failure / Missing Asset</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label={<span style={{ fontWeight: 600 }}>Notes & Field Observations</span>}
          name="notes"
        >
          <TextArea rows={4} placeholder="Describe site condition, verified physical milestones, vendor machinery, and photographic evidence notes..." />
        </Form.Item>

        <Form.Item
          label={<span style={{ fontWeight: 600 }}>Geo-Tagged Photo Reference Link</span>}
          name="photo_reference"
        >
          <Input placeholder="https://mplads.gov.in/inspections/GEO-INSP-303916.jpg" />
        </Form.Item>

        <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading} style={{ background: '#059669', borderColor: '#059669' }}>
              Submit Inspection Dossier
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
