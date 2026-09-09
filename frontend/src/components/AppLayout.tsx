import React, { useState } from 'react'
import { Layout, Button, Space, Tag, Dropdown, Avatar, Typography, Tooltip } from 'antd'
import {
  GlobalOutlined,
  CompassOutlined,
  AlertOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  DownloadOutlined,
  PlusOutlined,
  RobotOutlined,
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ReportExportModal } from './ReportExportModal'
import { AddWorkModal } from './AddWorkModal'
import { AIChatbotModal } from './AIChatbotModal'

const { Sider, Content } = Layout
const { Text } = Typography

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [addWorkModalOpen, setAddWorkModalOpen] = useState(false)
  const [chatbotOpen, setChatbotOpen] = useState(false)

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

  const navItems = [
    {
      key: '/',
      label: 'Home',
      icon: <GlobalOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/'),
    },
    {
      key: '/state',
      label: 'State Explorer',
      icon: <CompassOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/state'),
    },
  ]

  if (!hasRole('ROLE_PUBLIC')) {
    navItems.push({
      key: '/alerts',
      label: 'Alert Triage',
      icon: <AlertOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/alerts'),
    })
  }

  if (hasRole('ROLE_ADMIN')) {
    navItems.push({
      key: '/admin',
      label: 'Admin Console',
      icon: <SettingOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/admin'),
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
    <Layout style={{ minHeight: '100vh', background: '#f4f5f8' }}>
      {/* Sleek Floating-Style Vertical Sidebar */}
      <Sider
        width={230}
        collapsedWidth={76}
        collapsed={collapsed}
        trigger={null}
        style={{
          background: '#ffffff',
          borderRight: '1px solid #edf0f2',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 12px' }}>
          {/* Brand Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'space-between',
              padding: '8px 6px 20px 6px',
              borderBottom: '1px solid #f1f3f5',
              marginBottom: 16,
            }}
          >
            {/* Logo / Brand */}
            <div
              onClick={() => navigate('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
            >
              <img
                src="/prahar-logo.jpg"
                alt="PRAHAR Logo"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  objectFit: 'cover',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  flexShrink: 0,
                  background: '#ffffff',
                }}
              />

              {!collapsed && (
                <div>
                  <div
                    style={{
                      fontFamily: 'Outfit, -apple-system, sans-serif',
                      fontWeight: 800,
                      fontSize: '18px',
                      letterSpacing: '0.04em',
                      color: '#0f2744',
                      lineHeight: 1.1,
                    }}
                  >
                    PRAHAR
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.06em', fontWeight: 700 }}>
                    AI AUDIT CONSOLE
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                display: collapsed ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '11px',
                transition: 'all 0.15s ease',
              }}
            >
              <LeftOutlined />
            </button>
          </div>

          {/* Nav Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.key
              return (
                <div
                  key={item.key}
                  onClick={item.onClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    gap: 12,
                    padding: collapsed ? '12px' : '10px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: isActive ? '#f1f5f9' : 'transparent',
                    color: isActive ? '#0f172a' : '#64748b',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '13.5px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = '#f8fafc'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#64748b'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: isActive ? '#10b981' : '#64748b' }}>{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </div>

                  {!collapsed && item.badge && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 8,
                        background: '#dcfce7',
                        color: '#15803d',
                        fontSize: '10.5px',
                        fontWeight: 700,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom Sider Footer */}
          <div style={{ borderTop: '1px solid #f1f3f5', paddingTop: 12 }}>
            <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Avatar size="small" icon={<UserOutlined />} style={{ background: '#10b981', flexShrink: 0 }} />
                {!collapsed && (
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>{user?.username}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>{user?.role.replace('ROLE_', '')}</div>
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </div>
      </Sider>

      {/* Main Layout Area */}
      <Layout style={{ background: '#f4f5f8' }}>
        {/* Top Minimal Action Header */}
        <div
          style={{
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            background: 'transparent',
          }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddWorkModalOpen(true)}
            style={{
              background: '#10b981',
              borderColor: '#10b981',
              color: '#fff',
              fontWeight: 600,
              borderRadius: 20,
              padding: '0 16px',
              height: 36,
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
            }}
          >
            + Add Project
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => setReportModalOpen(true)}
            style={{
              borderColor: '#e2e8f0',
              color: '#334155',
              borderRadius: 20,
              fontWeight: 500,
              height: 36,
              background: '#ffffff',
            }}
          >
            Export Report
          </Button>

          <Button
            icon={<RobotOutlined style={{ color: '#10b981' }} />}
            onClick={() => setChatbotOpen(true)}
            style={{
              borderColor: '#bbf7d0',
              color: '#15803d',
              borderRadius: 20,
              fontWeight: 600,
              height: 36,
              background: '#f0fdf4',
            }}
          >
            AI Assistant
          </Button>
        </div>

        {/* Content Body */}
        <Content style={{ padding: '0 28px 40px 28px', maxWidth: 1600, margin: '0 auto', width: '100%' }}>
          {children}
        </Content>
      </Layout>

      {/* Floating Action Button for AI Assistant */}
      <Tooltip title="Ask PRAHAR AI Assistant">
        <button
          onClick={() => setChatbotOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            zIndex: 999,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(16, 185, 129, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)'
          }}
        >
          <RobotOutlined />
        </button>
      </Tooltip>

      {/* Report Export Modal */}
      <ReportExportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} />

      {/* Add New Work Project Modal */}
      <AddWorkModal
        open={addWorkModalOpen}
        onClose={() => setAddWorkModalOpen(false)}
        onSuccess={() => window.location.reload()}
      />

      {/* OpenRouter AI Chatbot Modal */}
      <AIChatbotModal open={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </Layout>
  )
}

export default AppLayout
