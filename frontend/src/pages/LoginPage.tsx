import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Space, Alert, Tag, Divider } from 'antd'
import { UserOutlined, LockOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const { Title, Text, Paragraph } = Typography

const DEMO_ACCOUNTS = [
  { label: 'Admin (All Access)', user: 'admin', pass: 'Admin@1234', role: 'ADMIN', color: '#ef4444' },
  { label: 'Ministry User', user: 'ministry_user', pass: 'Ministry@1234', role: 'MINISTRY', color: '#3b82f6' },
  { label: 'State Nodal (Maharashtra)', user: 'state_user', pass: 'State@1234', role: 'STATE_NODAL', color: '#8b5cf6' },
  { label: 'District Authority (Pune)', user: 'district_user', pass: 'District@1234', role: 'DISTRICT', color: '#f59e0b' },
  { label: 'Member of Parliament (Pune)', user: 'mp_user', pass: 'Mp@12345', role: 'MP', color: '#10b981' },
  { label: 'Public Observer', user: 'public_user', pass: 'Public@1234', role: 'PUBLIC', color: '#475569' },
]

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)
      setError(null)
      await login(values.username, values.password)
      navigate('/')
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.detail?.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (username: string, pass: string) => {
    form.setFieldsValue({ username, password: pass })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Portal Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src="/prahar-logo.jpg"
            alt="PRAHAR Logo"
            style={{
              width: 88,
              height: 88,
              objectFit: 'contain',
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
              marginBottom: 16,
              background: '#ffffff',
              padding: 4,
              border: '1px solid #e2e8f0',
            }}
          />

          <Title level={2} style={{ color: '#0f2744', marginBottom: 4, fontFamily: 'Outfit, sans-serif', fontWeight: 800, letterSpacing: '0.04em' }}>
            PRAHAR
          </Title>
          <Paragraph style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
            Automated Audit & Anomaly Detection for MPLADS Projects
          </Paragraph>
        </div>

        {/* Login Card */}
        <Card
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          }}
          bodyStyle={{ padding: '32px 28px' }}
        >
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 20 }}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Please enter your username' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Username (e.g. admin)"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Password"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                style={{
                  height: '44px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  fontWeight: 600,
                  fontSize: '15px',
                  borderRadius: 8,
                }}
              >
                Sign In to PRAHAR
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ borderColor: '#e2e8f0', margin: '24px 0 16px 0' }}>
            <span style={{ color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <ThunderboltOutlined style={{ color: '#d97706', marginRight: 4 }} /> 1-Click Demo Accounts
            </span>
          </Divider>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <Button
                key={acc.user}
                size="small"
                onClick={() => fillCredentials(acc.user, acc.pass)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  borderColor: '#e2e8f0',
                  color: '#334155',
                  borderRadius: 6,
                  height: '34px',
                  padding: '0 12px',
                }}
              >
                <span style={{ fontSize: '12px' }}>{acc.label}</span>
                <Tag
                  color={acc.color}
                  style={{
                    margin: 0,
                    fontSize: '10px',
                    fontWeight: 600,
                    borderRadius: 4,
                    padding: '0 6px',
                  }}
                >
                  {acc.user}
                </Tag>
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
