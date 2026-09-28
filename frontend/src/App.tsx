import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, Spin } from 'antd'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { AppLayout } from './components/AppLayout'
import { Role } from './types'

// Route-level code splitting (P2.10 & Section 13 bundle optimization)
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const NationalDashboardPage = lazy(() => import('./pages/NationalDashboardPage').then(m => ({ default: m.NationalDashboardPage })))
const StateDashboardPage = lazy(() => import('./pages/StateDashboardPage').then(m => ({ default: m.StateDashboardPage })))
const ConstituencyDetailPage = lazy(() => import('./pages/ConstituencyDetailPage').then(m => ({ default: m.ConstituencyDetailPage })))
const AlertManagementPage = lazy(() => import('./pages/AlertManagementPage').then(m => ({ default: m.AlertManagementPage })))
const ComplianceMonitoringPage = lazy(() => import('./pages/ComplianceMonitoringPage').then(m => ({ default: m.ComplianceMonitoringPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))

const LoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', background: 'var(--bg-primary)' }}>
    <Spin size="large" tip="Loading PRAHAR Console..." />
  </div>
)

const ProtectedRoute: React.FC<{
  children: React.ReactNode
  allowedRoles?: Role[]
}> = ({ children, allowedRoles }) => {
  const { user, loading, hasRole } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Spin size="large" tip="Authenticating..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/dashboard" replace />
  }

  return <AppLayout>{children}</AppLayout>
}

const ThemedAppContent: React.FC = () => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#3b82f6' : '#1d4ed8',
          colorBgBase: isDark ? '#070b13' : '#f8fafc',
          colorBgContainer: isDark ? '#10192d' : '#ffffff',
          colorBgElevated: isDark ? '#16223b' : '#ffffff',
          colorBorder: isDark ? '#1e2c45' : '#e2e8f0',
          colorBorderSecondary: isDark ? '#141f33' : '#f1f5f9',
          colorText: isDark ? '#f8fafc' : '#0f172a',
          colorTextSecondary: isDark ? '#cbd5e1' : '#475569',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 8,
        },
        components: {
          Card: {
            headerBg: isDark ? '#10192d' : '#ffffff',
          },
          Table: {
            headerBg: isDark ? '#0c1322' : '#f8fafc',
            headerColor: isDark ? '#cbd5e1' : '#334155',
          },
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/dashboard"
                element={
                  <AppLayout>
                    <NationalDashboardPage />
                  </AppLayout>
                }
              />
              <Route
                path="/state"
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_MINISTRY', 'ROLE_STATE_NODAL', 'ROLE_DISTRICT', 'ROLE_MP']}>
                    <StateDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/constituency/:id"
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_MINISTRY', 'ROLE_STATE_NODAL', 'ROLE_DISTRICT', 'ROLE_MP']}>
                    <ConstituencyDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN', 'ROLE_MINISTRY', 'ROLE_STATE_NODAL', 'ROLE_DISTRICT', 'ROLE_MP']}>
                    <AlertManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compliance"
                element={
                  <AppLayout>
                    <ComplianceMonitoringPage />
                  </AppLayout>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ROLE_ADMIN']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  )
}

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ThemedAppContent />
    </ThemeProvider>
  )
}

export default App
