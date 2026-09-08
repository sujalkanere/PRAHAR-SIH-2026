import React, { useState } from 'react'
import { Layout, Menu, Button, Space, Tag, Dropdown, Avatar, Typography } from 'antd'
import {
  DashboardOutlined,
  AlertOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  DownloadOutlined,
  GlobalOutlined,
  CompassOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ReportExportModal } from './ReportExportModal'
import { AddWorkModal } from './AddWorkModal'

const { Header, Content, Footer } = Layout
const { Text } = Typography

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [addWorkModalOpen, setAddWorkModalOpen] = useState(false)

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'ROLE_ADMIN':
        return '#dc2626'
      case 'ROLE_MINISTRY':
        return '#1d4ed8'
      case 'ROLE_STATE_NODAL':
        return '#7c3aed'
      case 'ROLE_DISTRICT':
        return '#d97706'
      case 'ROLE_MP':
        return '#059669'
      case 'ROLE_PUBLIC':
      default:
        return '#64748b'
    }
  }

  const menuItems = [
    {
      key: '/',
      icon: <GlobalOutlined />,
      label: 'National Overview',
    },
    {
      key: '/state',
      icon: <CompassOutlined />,
      label: 'State Dashboard',
    },
    {
      key: '/alerts',
      icon: <AlertOutlined />,
      label: 'Alert Management',
    },
  ]

  if (hasRole('ROLE_ADMIN')) {
    menuItems.push({
      key: '/admin',
      icon: <SettingOutlined />,
      label: 'Admin & Pipeline',
    })
  }

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: (
          <div style={{ padding: '6px 8px' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{user?.full_name}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{user?.username}</div>
            {user?.scope_value && (
              <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: 4, fontWeight: 500 }}>
                Scope: {user.scope_value} ({user.scope_type})
              </div>
            )}
          </div>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined style={{ color: '#dc2626' }} />,
        label: <span style={{ color: '#dc2626', fontWeight: 500 }}>Sign Out</span>,
        onClick: () => logout(),
      },
    ],
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        }}
      >
        {/* Left: Brand Logo & Title */}
        <Space size={16} align="center">
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '16px',
                boxShadow: '0 2px 8px rgba(29, 78, 216, 0.3)',
              }}
            >
              M
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 700,
                  fontSize: '17px',
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  lineHeight: 1.2,
                }}
              >
                MPLADS <span style={{ color: '#1d4ed8' }}>Sentinel</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.04em', fontWeight: 600 }}>
                AUDIT & ANOMALY INTELLIGENCE CONSOLE
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <Menu
            theme="light"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              background: 'transparent',
              borderBottom: 'none',
              marginLeft: 24,
              minWidth: 420,
              fontWeight: 500,
              color: '#334155',
            }}
          />
        </Space>

        {/* Right: Actions & User Profile */}
        <Space size={12} align="center">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddWorkModalOpen(true)}
            style={{
              background: '#15803d',
              borderColor: '#15803d',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 6,
            }}
          >
            + Add Project
          </Button>

          <Button
            type="default"
            icon={<DownloadOutlined />}
            onClick={() => setReportModalOpen(true)}
            style={{
              borderColor: '#cbd5e1',
              color: '#1d4ed8',
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            Export Report
          </Button>

          {user && (
            <Tag
              color={getRoleColor(user.role)}
              style={{
                fontWeight: 600,
                borderRadius: 6,
                padding: '2px 8px',
                margin: 0,
              }}
            >
              {user.role.replace('ROLE_', '')}
            </Tag>
          )}

          {user?.scope_value && (
            <Tag
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                borderColor: '#bfdbfe',
                borderRadius: 6,
                fontWeight: 600,
                margin: 0,
              }}
            >
              {user.scope_value}
            </Tag>
          )}

          <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '5px 12px',
                borderRadius: 8,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
              }}
            >
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ background: '#1d4ed8' }}
              />
              <Text style={{ color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
                {user?.username}
              </Text>
            </div>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
        {children}
      </Content>

      <Footer
        style={{
          textAlign: 'center',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          color: '#64748b',
          fontSize: '12px',
          padding: '16px 24px',
        }}
      >
        MPLADS Sentinel — AI Automated Audit & Anomaly Detection System (MoSPI) • Light Intelligence Console
      </Footer>

      {/* Report Export Modal */}
      <ReportExportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
      />

      {/* Add New Work Project Modal */}
      <AddWorkModal
        open={addWorkModalOpen}
        onClose={() => setAddWorkModalOpen(false)}
        onSuccess={() => {
          window.location.reload()
        }}
      />
    </Layout>
  )
}

export default AppLayout
