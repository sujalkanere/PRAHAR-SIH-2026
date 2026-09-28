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
  LoginOutlined,
  SafetyCertificateOutlined,
  HeartFilled,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ReportExportModal } from './ReportExportModal'
import { AddWorkModal } from './AddWorkModal'
import { AddInspectionModal } from './AddInspectionModal'
import { AIChatbotModal } from './AIChatbotModal'
import { ThemeToggle } from './ThemeToggle'

const { Sider, Content, Footer } = Layout
const { Text } = Typography

const AppFooter: React.FC = () => (
  <Footer
    style={{
      background: 'transparent',
      borderTop: '1px solid var(--border-primary)',
      padding: '24px 28px',
      textAlign: 'center',
      color: 'var(--text-muted)',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        Data sourced from official MPLADS portal • Last updated: 9/3/2026 •
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        © 2026 PRAHAR. All rights reserved.
      </div>
    </div>
  </Footer>
)

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasRole } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [addWorkModalOpen, setAddWorkModalOpen] = useState(false)
  const [addInspectionModalOpen, setAddInspectionModalOpen] = useState(false)
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
      default:
        return '#64748b'
    }
  }

  interface NavItem {
    key: string
    label: string
    icon: React.ReactNode
    onClick: () => void
    badge?: string
  }

  const navItems: NavItem[] = []

  if (user && hasRole('ROLE_ADMIN', 'ROLE_MINISTRY', 'ROLE_STATE_NODAL', 'ROLE_DISTRICT', 'ROLE_MP')) {
    const explorerLabel =
      user.role === 'ROLE_DISTRICT'
        ? `District Dashboard (${user.scope_value || 'Pune'})`
        : user.role === 'ROLE_MP'
        ? `Constituency Dashboard (${user.scope_value || 'Pune'})`
        : user.role === 'ROLE_STATE_NODAL'
        ? `State Explorer (${user.scope_value || 'Maharashtra'})`
        : 'National Explorer'

    const dashboardRoute = (user.role === 'ROLE_DISTRICT' || user.role === 'ROLE_MP') ? '/local' : '/dashboard'
    navItems.push({
      key: dashboardRoute,
      label: explorerLabel,
      icon: <GlobalOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate(dashboardRoute),
    })

    if (user.role === 'ROLE_MP' || user.role === 'ROLE_DISTRICT') {
      navItems.push({
        key: '/constituency/5b79b1d0370a4bdaa94de6a530987de7',
        label: user.role === 'ROLE_MP' ? 'Constituency Profile' : 'Pune District Works',
        icon: <ThunderboltOutlined style={{ fontSize: '16px' }} />,
        onClick: () => navigate('/constituency/5b79b1d0370a4bdaa94de6a530987de7'),
      })
    }

    if (user.role !== 'ROLE_MP') {
      navItems.push({
        key: '/state',
        label: 'State Explorer',
        icon: <CompassOutlined style={{ fontSize: '16px' }} />,
        onClick: () => {
          const stateQuery =
            user.role === 'ROLE_STATE_NODAL' || user.role === 'ROLE_DISTRICT'
              ? '?state=Maharashtra'
              : ''
          navigate(`/state${stateQuery}`)
        },
      })
    }

    navItems.push({
      key: '/alerts',
      label: 'Alert Triage',
      icon: <AlertOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/alerts'),
    })

    navItems.push({
      key: '/compliance',
      label: 'Compliance Engine',
      icon: <SafetyCertificateOutlined style={{ fontSize: '16px' }} />,
      onClick: () => navigate('/compliance'),
    })

    if (hasRole('ROLE_ADMIN')) {
      navItems.push({
        key: '/admin',
        label: 'Admin Console',
        icon: <SettingOutlined style={{ fontSize: '16px' }} />,
        onClick: () => navigate('/admin'),
      })
    }
  }

  const userMenu = {
    items: [
      {
        key: 'profile',
        label: (
          <div style={{ padding: '6px 8px' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.full_name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.username}</div>
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

  // The sidebar is only hidden for unauthenticated public visitors on the dashboard/landing page.
  // For all logged-in officials, the sidebar remains persistently on the left across all dashboards.
  const isPublicLandingPage = !user && (location.pathname === '/dashboard' || location.pathname === '/')

  if (isPublicLandingPage) {
    return (
      <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        {/* Landing Page Full-Width Header */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Brand Left */}
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
                width: 36,
                height: 36,
                borderRadius: 8,
                objectFit: 'cover',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
                background: 'var(--bg-surface)',
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontWeight: 800,
                  fontSize: '18px',
                  letterSpacing: '0.04em',
                  color: 'var(--text-primary)',
                  lineHeight: 1.1,
                }}
              >
                PRAHAR
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.06em', fontWeight: 700 }}>

              </div>
            </div>
          </div>

          {/* Center Nav Links - Only visible for authenticated RBAC roles */}
          {user && hasRole('ROLE_ADMIN', 'ROLE_MINISTRY', 'ROLE_STATE_NODAL', 'ROLE_DISTRICT', 'ROLE_MP') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button
                type="text"
                icon={<GlobalOutlined style={{ color: '#10b981' }} />}
                onClick={() => navigate('/dashboard')}
                style={{ fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-secondary)', borderRadius: 8 }}
              >
                National Explorer
              </Button>
              <Button
                type="text"
                icon={<CompassOutlined style={{ color: 'var(--text-muted)' }} />}
                onClick={() => navigate('/state')}
                style={{ fontWeight: 500, color: 'var(--text-secondary)', borderRadius: 8 }}
              >
                State Explorer
              </Button>
              <Button
                type="text"
                icon={<AlertOutlined style={{ color: 'var(--text-muted)' }} />}
                onClick={() => navigate('/alerts')}
                style={{ fontWeight: 500, color: 'var(--text-secondary)', borderRadius: 8 }}
              >
                Alert Triage
              </Button>
              {hasRole('ROLE_ADMIN') && (
                <Button
                  type="text"
                  icon={<SettingOutlined style={{ color: 'var(--text-muted)' }} />}
                  onClick={() => navigate('/admin')}
                  style={{ fontWeight: 500, color: 'var(--text-secondary)', borderRadius: 8 }}
                >
                  Admin Console
                </Button>
              )}
            </div>
          )}

          {/* Action Buttons Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user && hasRole('ROLE_ADMIN', 'ROLE_DISTRICT') && (
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
            )}

            {user && hasRole('ROLE_ADMIN', 'ROLE_DISTRICT') && (
              <Button
                type="primary"
                onClick={() => setAddInspectionModalOpen(true)}
                style={{
                  background: '#d97706',
                  borderColor: '#d97706',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 20,
                  padding: '0 16px',
                  height: 36,
                }}
              >
                Log Inspection
              </Button>
            )}

            <Button
              icon={<DownloadOutlined />}
              onClick={() => setReportModalOpen(true)}
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 20,
                fontWeight: 500,
                height: 36,
                background: 'var(--bg-surface)',
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

            {/* Accessible Theme Toggle */}
            <ThemeToggle />

            {!user ? (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => navigate('/login')}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  borderColor: '#1d4ed8',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 20,
                  padding: '0 18px',
                  height: 36,
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                Official Sign In
              </Button>
            ) : (
              <Dropdown menu={userMenu} placement="bottomRight" trigger={['click']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px',
                    borderRadius: 20,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#10b981' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.username}</span>
                </div>
              </Dropdown>
            )}
          </div>
        </div>

        {/* Content Body */}
        <Content style={{ padding: '24px 32px 40px 32px', maxWidth: 1600, margin: '0 auto', width: '100%', flex: 1 }}>
          {children}
        </Content>

        {/* Footer */}
        <AppFooter />

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
          >
            <RobotOutlined />
          </button>
        </Tooltip>

        <ReportExportModal open={reportModalOpen} onClose={() => setReportModalOpen(false)} />
        <AddWorkModal
          open={addWorkModalOpen}
          onClose={() => setAddWorkModalOpen(false)}
        />
        <AddInspectionModal
          open={addInspectionModalOpen}
          onClose={() => setAddInspectionModalOpen(false)}
        />
        <AIChatbotModal open={chatbotOpen} onClose={() => setChatbotOpen(false)} />
      </Layout>
    )
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sleek Floating-Style Vertical Sidebar */}
      <Sider
        width={230}
        collapsedWidth={76}
        collapsed={collapsed}
        trigger={null}
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-primary)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
          boxShadow: 'var(--shadow-sm)',
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
              borderBottom: '1px solid var(--border-secondary)',
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
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  flexShrink: 0,
                  background: 'var(--bg-surface)',
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
                      color: 'var(--text-primary)',
                      lineHeight: 1.1,
                    }}
                  >
                    PRAHAR
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.06em', fontWeight: 700 }}>

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
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-muted)',
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
                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '13.5px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--bg-surface-hover)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-muted)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: isActive ? '#10b981' : 'var(--text-muted)' }}>{item.icon}</span>
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
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 12 }}>
            {user ? (
              <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: '#10b981', flexShrink: 0 }} />
                  {!collapsed && (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.username}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{user.role.replace('ROLE_', '')}</div>
                    </div>
                  )}
                </div>
              </Dropdown>
            ) : (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => navigate('/login')}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  fontWeight: 600,
                  fontSize: '13px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!collapsed && 'Official Login'}
              </Button>
            )}
          </div>
        </div>
      </Sider>

      {/* Main Layout Area */}
      <Layout style={{ background: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          {user && hasRole('ROLE_ADMIN', 'ROLE_DISTRICT') && (
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
          )}

          {user && hasRole('ROLE_ADMIN', 'ROLE_DISTRICT') && (
            <Button
              type="primary"
              onClick={() => setAddInspectionModalOpen(true)}
              style={{
                background: '#d97706',
                borderColor: '#d97706',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 20,
                padding: '0 16px',
                height: 36,
              }}
            >
              Log Inspection
            </Button>
          )}

          <Button
            icon={<DownloadOutlined />}
            onClick={() => setReportModalOpen(true)}
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              borderRadius: 20,
              fontWeight: 500,
              height: 36,
              background: 'var(--bg-surface)',
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

          {/* Accessible Theme Toggle */}
          <ThemeToggle />

          {!user && (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={() => navigate('/login')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                borderColor: '#1d4ed8',
                color: '#fff',
                fontWeight: 600,
                borderRadius: 20,
                padding: '0 18px',
                height: 36,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              Official Sign In
            </Button>
          )}
        </div>

        {/* Content Body */}
        <Content
          style={{
            padding: '0 28px 40px 28px',
            maxWidth: 1600,
            margin: '0 auto',
            width: '100%',
            flex: 1,
          }}
        >
          {children}
        </Content>

        {/* Footer */}
        <AppFooter />
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
      />

      <AddInspectionModal
        open={addInspectionModalOpen}
        onClose={() => setAddInspectionModalOpen(false)}
      />

      {/* OpenRouter AI Chatbot Modal */}
      <AIChatbotModal open={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </Layout>
  )
}

export default AppLayout
