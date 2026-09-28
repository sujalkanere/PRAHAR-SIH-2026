import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Row,
  Col,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  message,
  Tabs,
} from 'antd'
import {
  DashboardOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  AuditOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  InfoCircleOutlined,
  BankOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  CloseOutlined,
  FileProtectOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  ExportOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { analyticsApi } from '../api/analytics'
import { NationalSummaryData } from '../types'
import { useTheme } from '../context/ThemeContext'
import { ThemeToggle } from '../components/ThemeToggle'

/* 
 * Replicated exactly from the official MPLADS reference screenshot:
 * - Top navy bar with accessibility controls (A- | A | A+)
 * - Overlaid header with Government of India & MoSPI title + Ashoka emblem
 * - Translucent centered nav pill (Home, About the Scheme, Dashboard, Citizen Request)
 * - Pure white Login pill button
 * - Parliament of India hero backdrop with lower-left title:
 *   "MPLADS: From Local Priorities to National Development" with cyan underline
 * - Sweeping tricolor organic wave with Documents and Videos circular badges
 * - Followed by official KPIs, PRAHAR's 6 detection engines, and Scheme history.
 */

export const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [data, setData] = useState<NationalSummaryData | null>(null)
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(() => {
    const saved = localStorage.getItem('prahar_font_offset')
    return saved ? parseInt(saved, 10) : 0
  })

  // Modals
  const [citizenModalOpen, setCitizenModalOpen] = useState(false)
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'cookies'>('privacy')
  const [docsModalOpen, setDocsModalOpen] = useState(false)
  const [videoModalOpen, setVideoModalOpen] = useState(false)

  // Cookie banner
  const [showCookieBanner, setShowCookieBanner] = useState<boolean>(() => {
    return !localStorage.getItem('prahar_cookie_consent')
  })

  // Citizen proposal flow
  const [otpSent, setOtpSent] = useState(false)
  const [otpValue, setOtpValue] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [activeTab, setActiveTab] = useState<'raise' | 'track'>('raise')
  const [citizenForm] = Form.useForm()

  useEffect(() => {
    loadSummaryData()
    // -1 = 88% (A-), 0 = 100% (A), 1 = 116% (A+)
    const zoomLevel = fontSizeOffset === -1 ? 0.88 : fontSizeOffset === 1 ? 1.16 : 1.0
    try {
      ; (document.body.style as any).zoom = `${zoomLevel}`
        ; (document.documentElement.style as any).zoom = `${zoomLevel}`
    } catch {
      // Graceful fallback
    }
    return () => {
      try {
        ; (document.body.style as any).zoom = '1'
          ; (document.documentElement.style as any).zoom = '1'
      } catch { }
    }
  }, [fontSizeOffset])

  const loadSummaryData = async () => {
    try {
      const res = await analyticsApi.getNationalSummary()
      setData(res)
    } catch {
      // Graceful fallback to verified official baseline metrics
    }
  }

  // Official live metrics with authentic fallbacks from current_data.json
  const totalAllocatedCr = data?.official_metrics?.total_allocated_cr ?? 3363.8
  const totalExpCr = data?.official_metrics?.total_expenditure_cr ?? 1237.9
  const rsWorks = data?.official_metrics?.rs_works ?? 6412
  const lsWorks = data?.official_metrics?.ls_works ?? 18732
  // Ensure Works Recommended total precisely matches the sum of the chamber bifurcation (Q1.4.1)
  const totalWorks = (rsWorks + lsWorks)
  const worksCompleted = data?.official_metrics?.works_completed ?? 9927
  // Total MPs: derived dynamically from live database query across both chambers (Q1.1)
  const totalMPs = data?.official_metrics?.total_mps ?? (data?.kpis?.find((k) => k.key === 'total_mps')?.value ?? 788)
  const rsMPs = data?.official_metrics?.rs_mps ?? 245
  const lsMPs = data?.official_metrics?.ls_mps ?? 543
  const worksSanctioned = 22127

  const handleSetFontSize = (offset: number) => {
    setFontSizeOffset(offset)
    localStorage.setItem('prahar_font_offset', offset.toString())
  }

  const handleCookieAccept = (type: 'all' | 'essential') => {
    localStorage.setItem('prahar_cookie_consent', type)
    setShowCookieBanner(false)
  }

  const openLegalModal = (tab: 'privacy' | 'terms' | 'cookies') => {
    setLegalTab(tab)
    setLegalModalOpen(true)
  }

  const handleSendOtp = () => {
    const phone = citizenForm.getFieldValue('mobile')
    if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) {
      message.error('Please enter a valid 10-digit mobile number')
      return
    }
    setOtpSent(true)
    message.success('Verification OTP [123456] dispatched to your mobile number')
  }

  const handleVerifyOtp = () => {
    if (otpValue === '123456' || otpValue.length === 6) {
      setIsVerified(true)
      message.success('Identity verified successfully')
    } else {
      message.error('Invalid OTP. Please enter 123456')
    }
  }

  const handleCitizenSubmit = () => {
    citizenForm.validateFields().then(() => {
      message.success('Developmental proposal submitted successfully to the PRAHAR Citizen Vigilance Repository.')
      citizenForm.resetFields()
      setOtpSent(false)
      setIsVerified(false)
      setOtpValue('')
      setCitizenModalOpen(false)
    })
  }

  // 6 Dedicated Detection Engines focusing solely on PRAHAR's verified statutory and analytical modules
  const detectionEngines = [
    {
      id: 'payment-risk',
      name: 'Payment Risk & Premature Disbursement',
      badge: 'Statutory Engine',
      color: '#dc2626',
      icon: <DollarOutlined aria-hidden="true" />,
      desc: 'Detects premature disbursements (>50% released on unstarted works), unreconciled expenditure overflows (>125%), and zero-expenditure ghost completions.',
      metric: 'Threshold & Ratio Rules · Live Pipeline',
      rule: 'PAY-001 / PAY-002 / PAY-003 Protocol',
    },
    {
      id: 'cost-overrun',
      name: 'Cost Overrun & ML Inflation Engine',
      badge: 'Statutory Engine',
      color: '#ea580c',
      icon: <AuditOutlined aria-hidden="true" />,
      desc: 'Audits actual expenditure against sanctioned approvals (>15% escalation), peer category Z-score deviations, and multidimensional Isolation Forest anomaly signals.',
      metric: 'Overrun Brackets + IsoForest · Calibrated',
      rule: 'Section 6.1 Cost Escalation Standard',
    },
    {
      id: 'sanction-delays',
      name: 'Project Delay & Stalling Sentinel',
      badge: 'Statutory Engine',
      color: '#d97706',
      icon: <ClockCircleOutlined aria-hidden="true" />,
      desc: 'Tracks milestone timeline breaches (>90d, >180d, >365d) and flags projects stalled with zero physical progress for more than 365 days since sanction.',
      metric: 'Chronological Milestones · Live Pipeline',
      rule: 'MPLADS Guideline 3.4.1 (75-Day Mandate)',
    },
    {
      id: 'duplicate-works',
      name: 'Semantic Duplicate Works Detector',
      badge: 'NLP Engine',
      color: '#0284c7',
      icon: <EnvironmentOutlined aria-hidden="true" />,
      desc: 'Identifies lexically disguised duplicate works and twin allocations within the same constituency using all-MiniLM-L6-v2 semantic embeddings and token overlap.',
      metric: 'Dense CosSim >0.85 + Jaccard Overlap',
      rule: 'Section 6.3 Semantic Duplicate Standard',
    },
    {
      id: 'compliance-feasibility',
      name: 'Regulatory Compliance & Chronology Engine',
      badge: 'Statutory Engine',
      color: '#7c3aed',
      icon: <CheckCircleOutlined aria-hidden="true" />,
      desc: 'Flags inverted chronology (completion preceding sanction), generic or unmapped implementing agencies, and impossible milestone delivery schedules.',
      metric: 'CMP-001 / CMP-002 / CMP-003 Rules',
      rule: 'MoSPI Regulatory Compliance Guidelines',
    },
    {
      id: 'durability-repair',
      name: 'Durability & Repeat Repair Sentinel',
      badge: 'Statutory Engine',
      color: '#059669',
      icon: <SafetyCertificateOutlined aria-hidden="true" />,
      desc: 'Monitors asset durability by flagging premature repeat repairs, renovation, or re-carpeting sanctioned on the same infrastructure within 365 days.',
      metric: 'Asset Lifecycle & Category Filtering',
      rule: 'Section 6.6 Durability & Quality Standard',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", transition: 'background-color 0.25s ease, color 0.25s ease' }}>
      {/* 1. Top Accessibility Dark Bar (Exact match from reference screenshot) */}
      <div
        role="region"
        aria-label="Accessibility Controls"
        style={{
          background: '#0b2545',
          padding: '6px 36px',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <ThemeToggle matchDarkBg={true} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ffffff', fontSize: '13px', fontWeight: 600 }}>
          <span style={{ fontSize: '12px', opacity: 0.85, marginRight: 2 }}>Text Size:</span>
          <button
            onClick={() => handleSetFontSize(-1)}
            style={{
              background: fontSizeOffset === -1 ? '#00d2ff' : 'transparent',
              color: fontSizeOffset === -1 ? '#0b2545' : '#ffffff',
              border: fontSizeOffset === -1 ? '1px solid #00d2ff' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 800,
              padding: '2px 8px',
              fontSize: '12px',
              lineHeight: '18px',
              transition: 'all 0.15s ease',
            }}
            aria-label="Decrease text size (A-)"
            aria-pressed={fontSizeOffset === -1}
          >
            A-
          </button>
          <span style={{ opacity: 0.3 }} aria-hidden="true">|</span>
          <button
            onClick={() => handleSetFontSize(0)}
            style={{
              background: fontSizeOffset === 0 ? '#00d2ff' : 'transparent',
              color: fontSizeOffset === 0 ? '#0b2545' : '#ffffff',
              border: fontSizeOffset === 0 ? '1px solid #00d2ff' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 800,
              padding: '2px 8px',
              fontSize: '13px',
              lineHeight: '18px',
              transition: 'all 0.15s ease',
            }}
            aria-label="Standard text size (A)"
            aria-pressed={fontSizeOffset === 0}
          >
            A
          </button>
          <span style={{ opacity: 0.3 }} aria-hidden="true">|</span>
          <button
            onClick={() => handleSetFontSize(1)}
            style={{
              background: fontSizeOffset === 1 ? '#00d2ff' : 'transparent',
              color: fontSizeOffset === 1 ? '#0b2545' : '#ffffff',
              border: fontSizeOffset === 1 ? '1px solid #00d2ff' : '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 800,
              padding: '2px 8px',
              fontSize: '14px',
              lineHeight: '18px',
              transition: 'all 0.15s ease',
            }}
            aria-label="Increase text size (A+)"
            aria-pressed={fontSizeOffset === 1}
          >
            A+
          </button>
        </div>
      </div>

      {/* 2. Hero Section (Replicating exact Parliament photo & overlaid navbar from screenshot) */}
      <section
        style={{
          position: 'relative',
          minHeight: '660px',
          backgroundImage: 'url(/parliament-hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 42%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {/* Soft top gradient to ensure navbar readability */}
        <div
          role="presentation"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '140px',
            background: 'linear-gradient(180deg, rgba(11, 37, 69, 0.72) 0%, rgba(11, 37, 69, 0.2) 60%, rgba(0, 0, 0, 0) 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Soft dark vignette on bottom-left for title text contrast */}
        <div
          role="presentation"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 15% 65%, rgba(10, 25, 47, 0.78) 0%, rgba(10, 25, 47, 0.35) 45%, rgba(0, 0, 0, 0.05) 80%)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        {/* Overlaid Navbar Header (Exact layout from reference screenshot) */}
        <header
          role="banner"
          style={{
            position: 'relative',
            zIndex: 10,
            padding: '16px 36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: Emblem + 3-line Government of India typography */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img
              src="/ashok-stambh.png"
              alt="Ashok Stambh - National Emblem of India"
              style={{
                height: 52,
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
            <div style={{ color: '#ffffff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.02em', opacity: 0.95 }}>
                Government of India
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, lineHeight: 1.25 }}>
                Ministry of Statistics and Programme Implementation
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, opacity: 0.95 }}>
                Members of Parliament Local Area Development Scheme
              </div>
            </div>
          </div>

          {/* Center: Translucent Dark Glassmorphic Nav Pill */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 22,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 9999,
              padding: '8px 26px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            }}
          >
            <a
              href="#home"
              style={{
                color: '#00d2ff',
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              Home
            </a>
            <a
              href="#how-it-works"
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              How It Works
            </a>
            <a
              href="#why-prahar"
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              Why PRAHAR
            </a>
            <a
              href="#about-scheme"
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              About Scheme
            </a>
            <a
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault()
                navigate('/dashboard')
              }}
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              Dashboard
            </a>
            <a
              href="/compliance"
              onClick={(e) => {
                e.preventDefault()
                navigate('/compliance')
              }}
              style={{
                color: '#ffffff',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '13.5px',
                letterSpacing: '0.01em',
              }}
            >
              Compliance
            </a>
          </nav>

          {/* Right: Pill Login Button */}
          <Button
            onClick={() => navigate('/login')}
            style={{
              borderRadius: 9999,
              background: isDark ? 'var(--bg-surface)' : '#ffffff',
              color: isDark ? 'var(--text-primary)' : '#0f2744',
              fontWeight: 700,
              fontSize: '13.5px',
              height: 38,
              padding: '0 22px',
              border: isDark ? '1px solid var(--border-primary)' : 'none',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
            }}
            aria-label="Access Role-Based Secured Portal"
          >
            Login
          </Button>
        </header>

        {/* Hero Title (Lower-Left Placement matching reference screenshot) */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            maxWidth: 1600,
            margin: '0 auto',
            padding: '0 36px 140px 36px',
            width: '100%',
          }}
        >
          <div style={{ maxWidth: 760 }}>
            {/* Main Headline */}
            <h1
              style={{
                fontFamily: 'Outfit, -apple-system, sans-serif',
                fontSize: '44px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
                margin: '0 0 14px 0',
                textShadow: '0 3px 14px rgba(0,0,0,0.65)',
              }}
            >
              <span style={{ color: '#00c0f0', fontWeight: 900 }}>PRAHAR</span>: Automated Audit & Anomaly Detection for MPLADS Projects
            </h1>

            {/* Subhead */}
            <p
              style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: '#e2e8f0',
                margin: '0 0 24px 0',
                maxWidth: 680,
                textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              }}
            >
              PRAHAR combines explainable AI with rule-based checks to catch cost overruns, payment fraud, ghost vendors, delayed works, and failing assets across MPLADS projects. Every flag comes with the reasoning behind it, and it's built to surface problems early, while there's still time to act.
            </p>
          </div>
        </div>

        {/* Sweeping Tricolor Wave with Documents & Videos circular buttons */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '220px',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          {/* SVG Wave Shape */}
          <svg
            viewBox="0 0 1440 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            {/* Saffron Ribbon Stroke */}
            <path
              d="M0,170 C260,230 480,240 720,200 C980,150 1140,75 1440,25 L1440,33 C1140,83 980,158 720,208 C480,248 260,238 0,178 Z"
              fill="#ff7a00"
            />
            {/* Green Ribbon Stroke */}
            <path
              d="M0,178 C260,238 480,248 720,208 C980,158 1140,83 1440,33 L1440,41 C1140,91 980,166 720,216 C480,256 260,246 0,186 Z"
              fill="#138808"
            />
            {/* Fill below wave */}
            <path
              d="M0,186 C260,246 480,256 720,216 C980,166 1140,91 1440,41 L1440,260 L0,260 Z"
              fill={isDark ? '#070b13' : '#ffffff'}
            />
          </svg>
        </div>
      </section>

      {/* Main Page Content */}
      <main id="main-content" role="main">
        {/* 3. Live MPLADS Statistics Ribbon (6 Cards with RS & LS Bifurcation) */}
        <section
          id="live-kpis"
          aria-labelledby="statistics-heading"
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: '36px 36px 48px 36px',
            background: 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: 'var(--color-primary)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                <BankOutlined aria-hidden="true" /> National Implementation Snapshot
              </div>
              <h2
                id="statistics-heading"
                style={{
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Official MPLADS Scheme Performance
              </h2>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: 4 }}>
                Synchronized with the official eSAKSHI data pipeline with Rajya Sabha and Lok Sabha distribution
              </div>
            </div>
          </div>

          <Row gutter={[20, 20]}>
            {/* Card 1: Members of Parliament */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Total MPs Monitored</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    {totalMPs}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Rajya Sabha: <b style={{ color: 'var(--text-primary)' }}>{rsMPs}</b></span>
                  <span>Lok Sabha: <b style={{ color: 'var(--text-primary)' }}>{lsMPs}</b></span>
                </div>
              </div>
            </Col>

            {/* Card 2: Allocated Limit */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Allocated Outlay</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-primary)', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    ₹{totalAllocatedCr.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>RS: <b style={{ color: 'var(--text-primary)' }}>₹1,155.0 Cr</b></span>
                  <span>LS: <b style={{ color: 'var(--text-primary)' }}>₹2,208.8 Cr</b></span>
                </div>
              </div>
            </Col>

            {/* Card 3: Works Recommended */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Works Recommended</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    {Number(totalWorks).toLocaleString()}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>RS: <b style={{ color: 'var(--text-primary)' }}>{Number(rsWorks).toLocaleString()}</b></span>
                  <span>LS: <b style={{ color: 'var(--text-primary)' }}>{Number(lsWorks).toLocaleString()}</b></span>
                </div>
              </div>
            </Col>

            {/* Card 4: Works Sanctioned */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Works Sanctioned</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0284c7', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    {worksSanctioned.toLocaleString()}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>RS: <b style={{ color: 'var(--text-primary)' }}>5,640</b></span>
                  <span>LS: <b style={{ color: 'var(--text-primary)' }}>16,487</b></span>
                </div>
              </div>
            </Col>

            {/* Card 5: Works Completed */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Works Completed</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    {worksCompleted.toLocaleString()}
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>RS: <b style={{ color: 'var(--text-primary)' }}>2,890</b></span>
                  <span>LS: <b style={{ color: 'var(--text-primary)' }}>7,037</b></span>
                </div>
              </div>
            </Col>

            {/* Card 6: Total Expenditure */}
            <Col xs={24} sm={12} lg={8} xl={4}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 12,
                  padding: '20px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Total Expenditure</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0d9488', margin: '8px 0 12px 0', fontFamily: 'Outfit, sans-serif' }}>
                    ₹{totalExpCr.toLocaleString('en-IN', { maximumFractionDigits: 1 })} Cr
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-primary)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>RS: <b style={{ color: 'var(--text-primary)' }}>₹389.2 Cr</b></span>
                  <span>LS: <b style={{ color: 'var(--text-primary)' }}>₹848.7 Cr</b></span>
                </div>
              </div>
            </Col>
          </Row>
        </section>

        {/* Role-Based Access Callout (Requirement 7) */}
        <section
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: '0 36px 40px 36px',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 16,
              padding: '28px 32px',
              border: '1.5px solid var(--border-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                  marginBottom: 6,
                }}
              >
                MULTI TENANT RBAC
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                Built for Every Stakeholder in the MPLADS Governance Chain
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: 4, maxWidth: 880 }}>
                Role-tailored interfaces: Ministry policy oversight, District inquiry queues, MP constituency visibility, and citizen public accountability — each with granular cryptographic access control.
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border-primary)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                      01
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      Ministry of Statistics (MoSPI)
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Macro-level national risk maps, TSA idle float tracking, policy exception reporting.
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border-primary)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdfa', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                      02
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      District Authorities (DM / DC)
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Prioritized investigation queue, contractor audit records, technical sanction verification.
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border-primary)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                      03
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      Members of Parliament (MPs)
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Real-time recommendation tracking, milestone delivery alerts, bottleneck resolution.
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '20px', border: '1px solid var(--border-primary)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fff7ed', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, fontFamily: 'Outfit, sans-serif', flexShrink: 0 }}>
                      04
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      Citizen & Public Vigilance
                    </div>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    Open access asset verification, geotagged proof check, local priority proposal tracking.
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </section>

        {/* 4. Project Focus: PRAHAR Detection Engines Grid */}
        <section
          id="engines"
          aria-labelledby="engines-heading"
          style={{
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '64px 36px',
          }}
        >
          <div style={{ maxWidth: 1600, margin: '0 auto' }}>
            {/* Section Header */}
            <div style={{ maxWidth: 840, marginBottom: 40 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#0369a1',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                <SafetyCertificateOutlined aria-hidden="true" /> The PRAHAR Surveillance Architecture
              </div>
              <h2
                id="engines-heading"
                style={{
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '34px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: 12,
                }}
              >
                Autonomous Multi-Detector Intelligence for MPLADS
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                PRAHAR replaces retrospective manual audits with an active, automated surveillance mesh.
                Six specialized algorithmic engines ingest live eSAKSHI data, bank transaction trails,
                and schedule norms to intercept financial and procedural irregularities before final disbursement.
              </p>
            </div>

            {/* 6 Engine Cards Grid */}
            <Row gutter={[24, 24]}>
              {detectionEngines.map((engine) => (
                <Col xs={24} md={12} lg={8} key={engine.id}>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 12,
                      padding: '24px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = engine.color
                      e.currentTarget.style.boxShadow = `0 6px 20px ${engine.color}25`
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)'
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                      e.currentTarget.style.transform = 'none'
                    }}
                  >
                    <div>
                      {/* Top Row: Icon + Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: `${engine.color}15`,
                            color: engine.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                          }}
                          aria-hidden="true"
                        >
                          {engine.icon}
                        </div>

                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: engine.color,
                            letterSpacing: '0.02em',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: engine.color,
                              display: 'inline-block',
                            }}
                            aria-hidden="true"
                          />
                          {engine.badge}
                        </div>
                      </div>

                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                        {engine.name}
                      </h3>

                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 18 }}>
                        {engine.desc}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Impact Scale:</span>
                        <span style={{ fontWeight: 700, color: engine.color }}>{engine.metric}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: 4, color: 'var(--text-muted)' }}>
                        <span>Statutory Baseline:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{engine.rule}</span>
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>

            {/* Engine Banner CTA */}
            <div
              style={{
                marginTop: 40,
                background: 'linear-gradient(135deg, #0f2744 0%, #1e3a5f 100%)',
                borderRadius: 16,
                padding: '28px 36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 20,
                color: '#ffffff',
              }}
            >
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: 4 }}>
                  Ready to review live anomalies across constituencies?
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1' }}>
                  Access the multi-detector intelligence console with interactive maps, vendor graphs, and triage workflows.
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                icon={<DashboardOutlined aria-hidden="true" />}
                onClick={() => navigate('/dashboard')}
                style={{
                  height: 44,
                  padding: '0 24px',
                  borderRadius: 22,
                  background: '#1d4ed8',
                  borderColor: '#1d4ed8',
                  fontWeight: 700,
                  fontSize: '14px',
                  boxShadow: '0 4px 12px rgba(29, 78, 216, 0.4)',
                }}
                aria-label="Open Live Risk Dashboard Console"
              >
                Open Live Dashboard
              </Button>
            </div>
          </div>
        </section>

        {/* 5. How a Flag Becomes an Action (Requirement 5) */}
        <section
          id="how-it-works"
          aria-labelledby="workflow-heading"
          style={{
            background: 'var(--bg-primary)',
            padding: '64px 36px',
            borderTop: '1px solid var(--border-primary)',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ maxWidth: 1600, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 20,
                marginBottom: 36,
              }}
            >
              <div style={{ maxWidth: 860 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: 'Outfit, -apple-system, sans-serif',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: '#0369a1',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  <AuditOutlined aria-hidden="true" /> Operational Verification Architecture
                </div>
                <h2
                  id="workflow-heading"
                  style={{
                    fontFamily: 'Outfit, -apple-system, sans-serif',
                    fontSize: '32px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    marginBottom: 12,
                  }}
                >
                  How a Flag Becomes an Action
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
                  AI flags potential irregularities. Authorities verify documents, request clarification, and conduct the actual investigation before any action is taken.
                </p>
              </div>

              {/* Video Button */}
              <div
                onClick={() => setVideoModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 22px',
                  borderRadius: 30,
                  background: 'var(--bg-surface)',
                  border: '1.5px solid var(--border-primary)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = '#0284c7'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.16)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.borderColor = 'var(--border-primary)'
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                }}
                role="button"
                tabIndex={0}
                aria-label="Watch onboarding and system overview videos"
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '20px',
                    boxShadow: '0 4px 10px rgba(15, 40, 74, 0.28)',
                  }}
                >
                  <PlayCircleOutlined aria-hidden="true" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    Videos
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Watch System Overview
                  </div>
                </div>
              </div>
            </div>

            {/* 3x2 Balanced Responsive Grid (Eliminating trailing whitespace) */}
            <Row gutter={[20, 20]}>
              {[
                {
                  step: '01',
                  phase: 'Ingestion Phase',
                  title: 'Data Ingestion',
                  desc: 'Continuous streaming of eSAKSHI works, PFMS transaction vouchers, bank feeds, and state DSR rate databases into the secure surveillance engine.',
                  badge: 'Automated Pipeline',
                  color: '#0284c7',
                },
                {
                  step: '02',
                  phase: 'Analysis Phase',
                  title: 'AI + Rule-Based Analysis',
                  desc: 'Dual-pass evaluation combining deterministic statutory rules (GFR, limits) with ML heuristic anomaly detectors (Benford, NLP, GIS).',
                  badge: 'Dual Verification',
                  color: '#1d4ed8',
                },
                {
                  step: '03',
                  phase: 'Scoring Phase',
                  title: 'Explainable 0–100 Risk Score',
                  desc: 'Every work receives an intuitive score with transparent feature attribution breakdown and factor weighting. Zero black-box obscurity.',
                  badge: 'Full Transparency',
                  color: '#7c3aed',
                },
                {
                  step: '04',
                  phase: 'Triage Phase',
                  title: 'Prioritized Investigation Queue',
                  desc: 'High and Critical risk flags are automatically categorized and routed to District Magistrate & Nodal Officer triage workbenches by urgency.',
                  badge: 'Triage Routing',
                  color: '#d97706',
                },
                {
                  step: '05',
                  phase: 'Oversight Phase',
                  title: 'Human Verification by Authorities',
                  desc: 'Competent officers inspect contractor GSTIN filings, demand physical milestone geotags, and issue formal clarification notices before decisions.',
                  badge: 'Officer Oversight',
                  color: '#ea580c',
                },
                {
                  step: '06',
                  phase: 'Closure Phase',
                  title: 'Resolution & Accountability',
                  desc: 'Formal closure with audited evidence trail, Just-In-Time disbursement release, administrative rectification, or statutory recovery proceedings.',
                  badge: 'Audited Closure',
                  color: '#16a34a',
                },
              ].map((item, idx) => (
                <Col xs={24} sm={12} lg={8} key={idx}>
                  <div
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 12,
                      padding: '24px 22px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = item.color
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.transform = 'none'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              fontFamily: 'Outfit, sans-serif',
                              fontSize: '24px',
                              fontWeight: 900,
                              color: item.color,
                              letterSpacing: '-0.03em',
                            }}
                          >
                            {item.step}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {item.phase}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: item.color,
                            letterSpacing: '0.02em',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: item.color,
                              display: 'inline-block',
                            }}
                            aria-hidden="true"
                          />
                          {item.badge}
                        </div>
                      </div>
                      <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.3 }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* 6. Why PRAHAR Section (Requirement 6) */}
        <section
          id="why-prahar"
          aria-labelledby="why-heading"
          style={{
            background: 'var(--bg-secondary)',
            padding: '64px 36px',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ maxWidth: 1600, margin: '0 auto' }}>
            <div style={{ maxWidth: 840, marginBottom: 36 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#0369a1',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                <SafetyCertificateOutlined aria-hidden="true" /> Core Architectural Strengths
              </div>
              <h2
                id="why-heading"
                style={{
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: 10,
                }}
              >
                Why PRAHAR
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>
                Engineered specifically for sovereign public financial integrity, combining forensic depth with judicial explainability.
              </p>
            </div>

            <Row gutter={[24, 24]}>
              <Col xs={24} md={8}>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 14,
                    padding: '30px 24px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      marginBottom: 18,
                    }}
                  >
                    <BarChartOutlined />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                    Comprehensive Risk Analysis
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Integrates financial, progress, inspection, and asset-quality signals — not just spending data. Cross-examines GST filings, GPS photo metadata, and state civil schedules simultaneously.
                  </p>
                </div>
              </Col>

              <Col xs={24} md={8}>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 14,
                    padding: '30px 24px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: isDark ? 'rgba(168, 85, 247, 0.15)' : '#fdf4ff',
                      color: '#a855f7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      marginBottom: 18,
                    }}
                  >
                    <AuditOutlined />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                    Explainable & Transparent
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Every score of 0–100 comes with the specific factors that produced it, never a black-box number. Officers view exact statutory rule violations, price delta percentages, and coordinate distances.
                  </p>
                </div>
              </Col>

              <Col xs={24} md={8}>
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 14,
                    padding: '30px 24px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: isDark ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      marginBottom: 18,
                    }}
                  >
                    <ClockCircleOutlined />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                    Actionable Prioritization
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Ranks projects by risk so investigators focus on the highest-risk cases first, not every case equally. Transforms hundreds of raw project alerts into a clear, triageable daily action queue.
                  </p>
                </div>
              </Col>
            </Row>
          </div>
        </section>

        {/* 7. Problem Validation & CAG Performance Audit Evidence (Requirement 8) */}
        <section
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: '56px 36px 20px 36px',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderLeft: '4px solid var(--color-primary)',
              borderRadius: '0 12px 12px 0',
              padding: '28px 32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Outfit, -apple-system, sans-serif',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                Problem Validation • Audit Evidence
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Comptroller and Auditor General of India (CAG) Performance Audit Report No. 31 of 2010–11
              </span>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
              Why Continuous Algorithmic Monitoring is Critical for MPLADS
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>
              CAG Performance Audit Report No. 31 of 2010–11 documented persistent challenges in MPLADS execution, including fund underutilization, irregular payments, asset verification deficits, and extensive monitoring gaps across districts. Traditional retrospective audits occur years after disbursements occur; PRAHAR solves this by embedding proactive, real-time algorithmic oversight to detect irregularities before funds are lost, not after.
            </p>
          </div>
        </section>

        {/* 8. Deprioritized & Concise Scheme Context (Requirement 9) */}
        <section
          id="about-scheme"
          aria-labelledby="about-scheme-heading"
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            padding: '20px 36px 64px 36px',
            background: 'var(--bg-primary)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-primary)',
              borderRadius: 14,
              padding: '28px 32px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div style={{ maxWidth: 840 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                  Statutory Scheme Background
                </div>
                <h3 id="about-scheme-heading" style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                  Members of Parliament Local Area Development Scheme (MPLADS)
                </h3>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                  Launched in December 1993 and administered by the Ministry of Statistics and Programme Implementation (MoSPI), MPLADS enables MPs to recommend durable capital works in their constituencies with an annual allocation of ₹5 Crore per MP. Following the April 2023 transition to the 100% paperless eSAKSHI portal and the April 2025 Treasury Single Account (TSA) Just-In-Time release mechanism, PRAHAR serves as the automated integrity and risk analytics sentinel across the scheme's national lifecycle.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Button
                  onClick={() => setDocsModalOpen(true)}
                  icon={<FileTextOutlined />}
                  style={{ borderRadius: 8, fontSize: '13px', fontWeight: 600, background: 'var(--bg-surface-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
                >
                  Guidelines & SOPs
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Documents & Guidelines Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <FileTextOutlined style={{ color: 'var(--color-primary)', fontSize: '20px' }} aria-hidden="true" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Official MPLADS & PRAHAR Governance Documents
            </span>
          </div>
        }
        open={docsModalOpen}
        onCancel={() => setDocsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDocsModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={760}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>
          {[
            {
              title: 'Revised MPLADS Guidelines 2023',
              desc: 'Official Ministry of Statistics & Programme Implementation (MoSPI) comprehensive framework governing work eligibility, sanction workflows, and TSA fund-flow mandates.',
              date: 'April 2023',
              size: '4.1 KB PDF',
              downloadUrl: '/docs/Revised_MPLADS_Guidelines_2023.pdf',
              portalUrl: 'https://esakshi.mospi.gov.in/',
              portalLabel: 'e-SAKSHI Portal',
              fileName: 'Revised_MPLADS_Guidelines_2023.pdf',
            },
            {
              title: 'TSA (Treasury Single Account) Just-In-Time Fund Procedure',
              desc: 'Ministry of Finance & Department of Expenditure (DoE) Standard Operating Procedure for real-time vendor disbursements via RBI e-Kuber and PFMS integration.',
              date: 'April 2025',
              size: '3.9 KB PDF',
              downloadUrl: '/docs/TSA_Just_In_Time_Fund_Procedure.pdf',
              portalUrl: 'https://doe.gov.in/order-circular/procedure-release-funds-under-centrally-sponsored-schemes-and-monitoring-utilization',
              portalLabel: 'DoE Circular',
              fileName: 'TSA_Just_In_Time_Fund_Procedure.pdf',
            },
            {
              title: 'PRAHAR Multi-Detector Audit Architecture Whitepaper',
              desc: 'Technical specification of algorithmic anomaly scoring, Benford first-digit distribution checks, vendor cartel graphs, and DSR schedule matching.',
              date: 'September 2026',
              size: '3.8 KB PDF',
              downloadUrl: '/docs/PRAHAR_Audit_Architecture_Whitepaper.pdf',
              portalUrl: '/api/v1/reports/pdf?scope=NATIONAL',
              portalLabel: 'Live Audit Report',
              fileName: 'PRAHAR_Audit_Architecture_Whitepaper.pdf',
            },
            {
              title: 'District Authority Onboarding & Feasibility Checklist',
              desc: 'Official template for NDAs and IDAs certifying technical estimates, Schedule of Rates (SOR) compliance, and contractor eligibility.',
              date: 'January 2026',
              size: '3.6 KB PDF',
              downloadUrl: '/docs/District_Authority_Checklist.pdf',
              portalUrl: 'https://mplads.gov.in/',
              portalLabel: 'MoSPI MPLADS',
              fileName: 'District_Authority_Checklist.pdf',
            },
          ].map((doc, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'var(--bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--border-primary)',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>{doc.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}>{doc.desc}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  Published: {doc.date} • {doc.size}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {doc.portalUrl && (
                  <Button
                    icon={<ExportOutlined />}
                    size="small"
                    href={doc.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontWeight: 600,
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border-primary)',
                      background: 'var(--bg-surface)',
                    }}
                    title={`Visit official resource: ${doc.portalLabel}`}
                  >
                    {doc.portalLabel}
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  size="small"
                  href={doc.downloadUrl}
                  download={doc.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontWeight: 600,
                    fontSize: '12px',
                    background: '#1d4ed8',
                    borderColor: '#1d4ed8',
                    color: '#ffffff',
                  }}
                >
                  Download PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* 7. Videos Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <PlayCircleOutlined style={{ color: 'var(--color-primary)', fontSize: '20px' }} aria-hidden="true" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              System Overview & Architecture Video
            </span>
          </div>
        }
        open={videoModalOpen}
        onCancel={() => setVideoModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          <div
            style={{
              position: 'relative',
              paddingBottom: '56.25%',
              height: 0,
              overflow: 'hidden',
              borderRadius: 12,
              background: '#000000',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
            }}
          >
            <iframe
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="PRAHAR System Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </Modal>

      {/* 8. Citizen Request Modal (Accessible, Privacy-Compliant with Form Consent) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <UserOutlined style={{ color: '#0d9488' }} aria-hidden="true" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Citizen Developmental Request Portal
            </span>
          </div>
        }
        open={citizenModalOpen}
        onCancel={() => {
          setCitizenModalOpen(false)
          setOtpSent(false)
          setIsVerified(false)
          setOtpValue('')
        }}
        footer={null}
        width={720}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          {/* Step 1: Mobile & OTP Authentication */}
          {!isVerified ? (
            <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: 12, border: '1px solid var(--border-primary)' }}>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Citizen Mobile Verification (OTP Authentication)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 4 }}>
                  As per MoSPI guidelines, citizen proposals require a verified mobile number to prevent automated spam and ensure accountability.
                </p>
              </div>

              <Form form={citizenForm} layout="vertical">
                <Form.Item
                  label="10-Digit Mobile Number"
                  name="mobile"
                  rules={[
                    { required: true, message: 'Please enter a valid mobile number' },
                    { pattern: /^[6-9]\d{9}$/, message: 'Please enter a valid 10-digit Indian mobile number' },
                  ]}
                >
                  <Input
                    prefix={<PhoneOutlined style={{ color: '#94a3b8' }} aria-hidden="true" />}
                    placeholder="E.g., 9876543210"
                    maxLength={10}
                    disabled={otpSent}
                    aria-label="Mobile Number for OTP"
                  />
                </Form.Item>

                {!otpSent ? (
                  <Button
                    type="primary"
                    block
                    onClick={handleSendOtp}
                    style={{ background: '#0d9488', borderColor: '#0d9488', fontWeight: 600, height: 40 }}
                    aria-label="Send verification OTP to mobile number"
                  >
                    Send Verification OTP
                  </Button>
                ) : (
                  <div>
                    <Form.Item
                      label="Enter 6-Digit OTP (Simulated Demo Code: 123456)"
                      required
                    >
                      <Input
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        value={otpValue}
                        onChange={(e) => setOtpValue(e.target.value)}
                        style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '0.25em', fontWeight: 700 }}
                        aria-label="6-Digit OTP"
                      />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button
                        type="primary"
                        block
                        onClick={handleVerifyOtp}
                        style={{ background: '#1d4ed8', borderColor: '#1d4ed8', fontWeight: 600, height: 40 }}
                        aria-label="Verify entered OTP"
                      >
                        Verify OTP & Proceed
                      </Button>
                      <Button
                        onClick={() => {
                          setOtpSent(false)
                          setOtpValue('')
                        }}
                        style={{ height: 40 }}
                        aria-label="Change mobile number"
                      >
                        Change Number
                      </Button>
                    </div>
                  </div>
                )}
              </Form>
            </div>
          ) : (
            /* Step 2: Request Submission Form with Explicit Consent Checkbox */
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                <Button
                  type={activeTab === 'raise' ? 'primary' : 'text'}
                  onClick={() => setActiveTab('raise')}
                  style={{ fontWeight: 600 }}
                >
                  Raise Proposal
                </Button>
                <Button
                  type={activeTab === 'track' ? 'primary' : 'text'}
                  onClick={() => setActiveTab('track')}
                  style={{ fontWeight: 600 }}
                >
                  Track Existing Requests
                </Button>
              </div>

              {activeTab === 'raise' ? (
                <Form form={citizenForm} layout="vertical" onFinish={handleCitizenSubmit}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="Citizen Full Name"
                        name="name"
                        rules={[{ required: true, message: 'Full name is required' }]}
                      >
                        <Input placeholder="E.g., Dr. Rajesh Kumar" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Email Address (Optional)"
                        name="email"
                        rules={[{ type: 'email', message: 'Enter a valid email' }]}
                      >
                        <Input placeholder="E.g., rajesh@example.com" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="State / UT"
                        name="state"
                        rules={[{ required: true, message: 'Please select state' }]}
                      >
                        <Select placeholder="Select State / UT">
                          <Select.Option value="Maharashtra">Maharashtra</Select.Option>
                          <Select.Option value="Uttar Pradesh">Uttar Pradesh</Select.Option>
                          <Select.Option value="Karnataka">Karnataka</Select.Option>
                          <Select.Option value="Tamil Nadu">Tamil Nadu</Select.Option>
                          <Select.Option value="Bihar">Bihar</Select.Option>
                          <Select.Option value="Gujarat">Gujarat</Select.Option>
                          <Select.Option value="Delhi">Delhi NCT</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="District"
                        name="district"
                        rules={[{ required: true, message: 'Please enter district' }]}
                      >
                        <Input placeholder="E.g., Pune / Varanasi" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="Constituency / MP Representation"
                        name="mpType"
                        rules={[{ required: true, message: 'Please select MP representation' }]}
                      >
                        <Select placeholder="Select Parliamentary House">
                          <Select.Option value="ls">Lok Sabha MP (Constituency Representative)</Select.Option>
                          <Select.Option value="rs">Rajya Sabha MP (State Nodal Nominee)</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Developmental Priority Sector"
                        name="sector"
                        rules={[{ required: true, message: 'Please select sector' }]}
                      >
                        <Select placeholder="Select Sector">
                          <Select.Option value="water">Drinking Water & Sanitation Facility</Select.Option>
                          <Select.Option value="education">Primary & Secondary School Infrastructure</Select.Option>
                          <Select.Option value="health">Public Health Centre & Dispensary</Select.Option>
                          <Select.Option value="roads">Roads, Bridges & Rural Pathways</Select.Option>
                          <Select.Option value="solar">Solar Lighting & Renewable Micro-Grid</Select.Option>
                          <Select.Option value="community">Community Welfare Centre / Panchayat Hall</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="Work Proposal Title"
                    name="workTitle"
                    rules={[{ required: true, message: 'Proposal title is required' }]}
                  >
                    <Input placeholder="E.g., Installation of Solar RO Drinking Water Plant in Gram Panchayat" />
                  </Form.Item>

                  <Form.Item
                    label="Locality & Need Description"
                    name="desc"
                    rules={[{ required: true, message: 'Please describe the community need' }]}
                  >
                    <Input.TextArea
                      rows={3}
                      placeholder="Specify locality details, estimated beneficiary population, and why this durable community asset is required..."
                    />
                  </Form.Item>

                  {/* Explicit DPDP Act / Privacy Consent Checkbox */}
                  <Form.Item
                    name="consent"
                    valuePropName="checked"
                    rules={[
                      {
                        validator: (_, value) =>
                          value
                            ? Promise.resolve()
                            : Promise.reject(new Error('Consent is required to submit proposal under public oversight rules')),
                      },
                    ]}
                    style={{ marginBottom: 16 }}
                  >
                    <Checkbox>
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        I declare the information provided is accurate and consent to MoSPI and the District Authority processing this proposal under the PRAHAR Citizen Vigilance framework, in accordance with the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            openLegalModal('privacy')
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1d4ed8',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          Privacy Policy
                        </button>
                        .
                      </span>
                    </Checkbox>
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <Button onClick={() => setCitizenModalOpen(false)}>Cancel</Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      style={{ background: '#0d9488', borderColor: '#0d9488', fontWeight: 600 }}
                      aria-label="Submit developmental proposal"
                    >
                      Submit Proposal
                    </Button>
                  </div>
                </Form>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                  <InfoCircleOutlined style={{ fontSize: '36px', color: '#94a3b8', marginBottom: 14 }} aria-hidden="true" />
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    No Active Requests on This Verified Number
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 6, maxWidth: 440, margin: '6px auto 0 auto' }}>
                    Proposals submitted through this portal undergo algorithmic duplicate screening before referral to the District Planning Committee.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 9. Legal & Compliance Modal (Privacy, Terms, Cookie Notice) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
            <FileProtectOutlined style={{ color: 'var(--color-primary)', fontSize: '20px' }} aria-hidden="true" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              PRAHAR Sovereign Compliance & Legal Center
            </span>
          </div>
        }
        open={legalModalOpen}
        onCancel={() => setLegalModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setLegalModalOpen(false)}>
            Close Document
          </Button>,
        ]}
        width={760}
      >
        <Tabs
          activeKey={legalTab}
          onChange={(k) => setLegalTab(k as any)}
          items={[
            {
              key: 'privacy',
              label: 'Privacy Policy',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>1. Data Governance & Statutory Basis</h4>
                  <p>
                    PRAHAR is a sovereign administrative intelligence and audit surveillance system operated under the <b>Ministry of Statistics and Programme Implementation (MoSPI)</b>, Government of India. This Privacy Policy governs the collection, processing, and retention of citizen developmental requests and administrative audit logs pursuant to the <b>Digital Personal Data Protection Act, 2023 (DPDP Act)</b> and the Information Technology Act, 2000.
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>2. Information Collected & Minimization</h4>
                  <p>
                    In accordance with data minimization principles, PRAHAR collects only data strictly necessary for processing local developmental proposals:
                  </p>
                  <ul style={{ paddingLeft: 20 }}>
                    <li><b>Citizen Submissions:</b> Verified 10-digit mobile number (for OTP authentication and duplicate prevention), Citizen Name, Email (optional), and Locality information.</li>
                    <li><b>Public Audit Telemetry:</b> Anonymized work execution milestones, contractor GSTINs, tender allocations, and public expenditure records sourced directly from the official eSAKSHI repository.</li>
                  </ul>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>3. Purpose of Processing</h4>
                  <p>
                    Collected data is processed exclusively to: (a) route citizen developmental recommendations to relevant District Authorities and Parliamentary representatives; (b) prevent sybil attacks and bot submissions; (c) generate aggregate public analytics on constituency needs. No personal data is ever sold, leased, or shared with commercial entities.
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>4. Data Security & Sovereignty</h4>
                  <p>
                    All datasets are stored on sovereign cloud infrastructure within the territory of India in accordance with CERT-In directives. Encryption at rest (AES-256) and in transit (TLS 1.3) is enforced across all endpoints.
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>5. Citizen Rights & Contact</h4>
                  <p>
                    Citizens have the right to request access, correction, or deletion of unapproved proposal records. For privacy queries, contact the Nodal Grievance Officer at <code>cna-mplads@mospi.gov.in</code>.
                  </p>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 12 }}>
                    Last Updated: September 2026 • MoSPI Policy Circular Ref: PRAHAR-DPA-2026-V1
                  </div>
                </div>
              ),
            },
            {
              key: 'terms',
              label: 'Terms & Conditions',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>1. Acceptance of Terms & Public Charter</h4>
                  <p>
                    Access to and use of the PRAHAR portal and its underlying data streams is provided by MoSPI subject to these Terms of Service. By utilizing the platform, you agree to comply with all applicable Union laws and administrative regulations.
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>2. Nature of Intelligence Analytics</h4>
                  <p>
                    PRAHAR’s anomaly detection engines compute probabilistic risk ratings (e.g. split transactions, cost overruns, timeline drift) based on statistical models including Benford’s Law and DSR variances. These flags serve as administrative advisory intelligence for MoSPI and District Collectors; they do not constitute judicial verdicts until verified through formal statutory audit under General Financial Rules (GFR).
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>3. Acceptable Use & Security Restrictions</h4>
                  <p>
                    Users shall not: (a) execute automated extraction scripts or denial-of-service attacks; (b) submit frivolous or fabricated citizen proposals; (c) attempt unauthorized credential access to restricted administrative roles. Violations may attract prosecution under Section 66 of the Information Technology Act.
                  </p>

                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 16 }}>4. Intellectual Property & Open Data</h4>
                  <p>
                    Official scheme data is published under the Government of India Open Data License. Visual interface assets and algorithmic models are proprietary sovereign assets of MoSPI.
                  </p>
                </div>
              ),
            },
            {
              key: 'cookies',
              label: 'Cookie Policy',
              children: (
                <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>1. Strictly Necessary Cookies & LocalStorage</h4>
                  <p>
                    PRAHAR does not use commercial marketing, tracking, or cross-site profiling cookies. We store strictly necessary local items to provide accessible user experience:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, marginBottom: 12, fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>Key Name</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>Category</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>Purpose & Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}><code>prahar_token</code></td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Essential</td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Maintains secure official session for authorized stakeholders (Session/24h).</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}><code>prahar_font_offset</code></td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Accessibility</td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Remembers citizen font enlargement (A-/A+) preferences across visits.</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}><code>prahar_cookie_consent</code></td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Compliance</td>
                        <td style={{ padding: '8px', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>Records user acceptance of data governance policies (Persistent).</td>
                      </tr>
                    </tbody>
                  </table>
                  <p>
                    Users may clear these keys at any time via browser settings without impairing public read-only access.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* 10. Subtle Floating Cookie & Accessibility Consent Banner */}
      {showCookieBanner && (
        <div
          role="region"
          aria-label="Cookie & Privacy Consent"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            maxWidth: '460px',
            zIndex: 9999,
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(16px)',
            borderRadius: 14,
            border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-lg)',
            padding: '18px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <SafetyCertificateOutlined style={{ color: 'var(--color-primary)', fontSize: '20px', marginTop: 2 }} aria-hidden="true" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Sovereign Privacy & Accessibility Notice
              </div>
              <p style={{ fontSize: '12px', lineHeight: 1.55, color: 'var(--text-secondary)', margin: '0 0 14px 0' }}>
                PRAHAR uses strictly necessary session storage for accessibility preferences and authorized console authentication. No commercial advertising cookies are used. Read our{' '}
                <button
                  type="button"
                  onClick={() => openLegalModal('privacy')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Privacy Policy
                </button>
                .
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handleCookieAccept('all')}
                  style={{ borderRadius: 6, fontWeight: 600, fontSize: '12px' }}
                >
                  Accept All
                </Button>
                <Button
                  size="small"
                  onClick={() => handleCookieAccept('essential')}
                  style={{ borderRadius: 6, fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                >
                  Essential Only
                </Button>
                <Button
                  type="text"
                  size="small"
                  onClick={() => openLegalModal('cookies')}
                  style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  Details
                </Button>
              </div>
            </div>
            <button
              onClick={() => setShowCookieBanner(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
              }}
              aria-label="Dismiss cookie notice"
            >
              <CloseOutlined style={{ fontSize: '12px' }} />
            </button>
          </div>
        </div>
      )}

      {/* 11. Footer (Evaluation Prototype - Remove Impersonation Risk) */}
      <footer
        role="contentinfo"
        style={{
          background: '#0a192f',
          color: '#cbd5e1',
          borderTop: '1px solid #1e3a5f',
          padding: '40px 36px 24px 36px',
        }}
      >
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 32,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: 32,
          }}
        >
          {/* Brand & Mission */}
          <div style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <img
                src="/prahar-logo.jpg"
                alt="PRAHAR Emblem"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  objectFit: 'cover',
                  background: '#ffffff',
                }}
              />
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em', fontFamily: 'Outfit, sans-serif' }}>
                PRAHAR • MPLADS
              </span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#cbd5e1', margin: 0 }}>
              Autonomous Multi-Detector Integrity Monitoring System for the Members of Parliament Local Area Development Scheme (MPLADS). Developed for evaluation in Smart India Hackathon 2026.
            </p>
          </div>

          {/* Official MPLADS Contact Info */}
          <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: 8, fontSize: '14px' }}>
              Official MPLADS Helpdesk:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, color: '#e2e8f0' }}>
              <PhoneOutlined style={{ color: '#38bdf8' }} aria-hidden="true" />
              <span>Landline: 011-2345602, 011-23455607</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0' }}>
              <MailOutlined style={{ color: '#38bdf8' }} aria-hidden="true" />
              <span>Email: cna-mplads@mospi.gov.in</span>
            </div>
          </div>

          {/* Legal & Compliance Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '13px', marginBottom: 2 }}>
              Legal & Compliance
            </div>
            <button
              onClick={() => openLegalModal('privacy')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', textAlign: 'left', padding: 0, cursor: 'pointer', fontSize: '13px' }}
            >
              Privacy Policy (DPDP 2023)
            </button>
            <button
              onClick={() => openLegalModal('terms')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', textAlign: 'left', padding: 0, cursor: 'pointer', fontSize: '13px' }}
            >
              Terms of Service & Charter
            </button>
            <button
              onClick={() => openLegalModal('cookies')}
              style={{ background: 'none', border: 'none', color: '#cbd5e1', textAlign: 'left', padding: 0, cursor: 'pointer', fontSize: '13px' }}
            >
              Cookie Policy & LocalStorage
            </button>
          </div>
        </div>

        {/* Bottom Disclaimer (SIH26102 Prototype - No Impersonation) */}
        <div
          style={{
            maxWidth: 1600,
            margin: '0 auto',
            paddingTop: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: '12px',
            color: '#94a3b8',
          }}
        >
          <div>
            PRAHAR | License: GODL-India
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>Last Updated: 9/3/2026</span>
            <span aria-hidden="true">•</span>
            <span>Designed per WCAG 2.1 AA & GIGW 3.0 guidelines</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
