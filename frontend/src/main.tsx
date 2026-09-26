import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason)
})

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class RootErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[REACT RENDER ERROR]', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
          background: '#fef2f2',
          minHeight: '100vh',
          color: '#991b1b',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
            Application Error Caught
          </h1>
          <p style={{ fontSize: '15px', marginBottom: '20px', color: '#b91c1c' }}>
            {this.state.error?.message || 'An unknown error occurred while rendering the page.'}
          </p>
          <pre style={{
            background: '#ffffff',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            fontSize: '13px',
            overflow: 'auto',
            maxHeight: '400px',
            color: '#1f2937',
          }}>
            {this.state.error?.stack}
            {'\n\nComponent Stack:\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)

