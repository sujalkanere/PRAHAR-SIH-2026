import React, { useState } from 'react'
import { Modal, Form, Input, DatePicker, Select, Button, message } from 'antd'
import { complianceApi } from '../api/compliance'

const { TextArea } = Input

interface Props {
  open: boolean
  onClose: () => void
  workId?: string // If null, allow user to input or we just assume it's opened from a specific work context
}

export const AddInspectionModal: React.FC<Props> = ({ open, onClose, workId }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleFinish = async (values: any) => {
    if (!values.work_id) {
      message.error("Work ID is required")
      return
    }
    setLoading(true)
    try {
      await complianceApi.createInspection({
        work_id: values.work_id,
        inspection_date: values.inspection_date.format('YYYY-MM-DD'),
        inspection_outcome: values.inspection_outcome,
        notes: values.notes,
        photo_reference: values.photo_reference,
      })
      message.success('Physical inspection logged successfully')
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
      title="Log Physical Inspection"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ work_id: workId, inspection_outcome: 'SATISFACTORY' }}
      >
        <Form.Item
          label="Work ID (UUID)"
          name="work_id"
          rules={[{ required: true, message: 'Please enter the exact Work UUID' }]}
        >
          <Input placeholder="Enter internal UUID of the work" disabled={!!workId} />
        </Form.Item>

        <Form.Item
          label="Inspection Date"
          name="inspection_date"
          rules={[{ required: true, message: 'Please select date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Inspection Outcome"
          name="inspection_outcome"
          rules={[{ required: true }]}
        >
          <Select>
            <Select.Option value="SATISFACTORY">Satisfactory</Select.Option>
            <Select.Option value="MINOR_ISSUES">Minor Issues / Snags</Select.Option>
            <Select.Option value="MAJOR_ISSUES">Major Defects</Select.Option>
            <Select.Option value="ASSET_FAILURE">Total Asset Failure / Missing</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Notes & Observations"
          name="notes"
        >
          <TextArea rows={4} placeholder="Describe site condition, defects, or comments..." />
        </Form.Item>

        <Form.Item
          label="Photo Reference Link"
          name="photo_reference"
        >
          <Input placeholder="https://storage..." />
        </Form.Item>

        <Form.Item style={{ marginTop: 24, marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Submit Report
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// We need Space from antd
import { Space } from 'antd'
