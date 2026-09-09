import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme, Spin } from 'antd'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppLayout } from './components/AppLayout'
import { Role } from './types'

// Route-level code splitting (P2.10 & Section 13 bundle optimization)
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))
const NationalDashboardPage = lazy(() => import('./pages/NationalDashboardPage').then(m => ({ default: m.NationalDashboardPage })))
const StateDashboardPage = lazy(() => import('./pages/StateDashboardPage').then(m => ({ default: m.StateDashboardPage })))
const ConstituencyDetailPage = lazy(() => import('./pages/ConstituencyDetailPage').then(m => ({ default: m.ConstituencyDetailPage })))
const AlertManagementPage = lazy(() => import('./pages/AlertManagementPage').then(m => ({ default: m.AlertManagementPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))

const LoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh' }}>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <Spin size="large" tip="Authenticating..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/" replace />
  }

  return <AppLayout>{children}</AppLayout>
}

export const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1d4ed8',
          colorBgBase: '#f8fafc',
          colorBgContainer: '#ffffff',
          colorBorder: '#e2e8f0',
          colorText: '#0f172a',
          colorTextSecondary: '#475569',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 8,
        },
        components: {
          Card: {
            headerBg: '#ffffff',
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#334155',
          },
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <NationalDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/state"
                element={
                  <ProtectedRoute>
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

export default App
