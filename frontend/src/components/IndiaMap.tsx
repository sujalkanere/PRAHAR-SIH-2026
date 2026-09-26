import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { StateSummaryItem } from '../types'
import {
  MapPin,
  Maximize2,
  Minimize2,
  Search,
  Sun,
  Moon,
  Sparkles,
  ExternalLink,
  X,
  Compass,
  RotateCcw,
  Layers,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'

// Import pre-projected high-precision vector path data (100% offline, zero-lag, instant 60fps render)
import rawMapPaths from '../data/indiaMapPaths.json'

// ──────────────────────────────────────────────────────────────
// Configuration & Normalization
// ──────────────────────────────────────────────────────────────

interface VectorState {
  id: string | number
  name: string
  path: string
  bounds: [[number, number], [number, number]]
  centroid: [number, number]
}

const mapPathsData: VectorState[] = rawMapPaths as VectorState[]

const STATE_NORMALIZATION: Record<string, string> = {
  'Orissa': 'Odisha',
  'Uttaranchal': 'Uttarakhand',
  'Andaman and Nicobar': 'Andaman & Nicobar',
  'Jammu and Kashmir': 'Jammu & Kashmir',
  'NCT of Delhi': 'Delhi',
}

export const normalizeStateName = (name: string): string => {
  return STATE_NORMALIZATION[name] || name
}

export interface RiskTierConfig {
  key: string
  label: string
  min: number
  // Obsidian Night Command Palette
  gradientDark: string
  strokeDark: string
  glowDark: string
  // Architectural Ivory Palette
  gradientLight: string
  strokeLight: string
  textLight: string
}

export const RISK_TIERS: RiskTierConfig[] = [
  {
    key: 'critical',
    label: 'Critical Risk',
    min: 75,
    gradientDark: 'url(#grad-critical-dark)',
    strokeDark: '#f43f5e',
    glowDark: 'rgba(244, 63, 94, 0.65)',
    gradientLight: 'url(#grad-critical-light)',
    strokeLight: '#be123c',
    textLight: '#9f1239',
  },
  {
    key: 'high',
    label: 'High Risk',
    min: 50,
    gradientDark: 'url(#grad-high-dark)',
    strokeDark: '#fb923c',
    glowDark: 'rgba(251, 146, 60, 0.55)',
    gradientLight: 'url(#grad-high-light)',
    strokeLight: '#c2410c',
    textLight: '#9a3412',
  },
  {
    key: 'medium',
    label: 'Medium Risk',
    min: 25,
    gradientDark: 'url(#grad-medium-dark)',
    strokeDark: '#facc15',
    glowDark: 'rgba(250, 204, 21, 0.45)',
    gradientLight: 'url(#grad-medium-light)',
    strokeLight: '#b45309',
    textLight: '#854d0e',
  },
  {
    key: 'low',
    label: 'Low Risk',
    min: 1,
    gradientDark: 'url(#grad-low-dark)',
    strokeDark: '#34d399',
    glowDark: 'rgba(52, 211, 153, 0.45)',
    gradientLight: 'url(#grad-low-light)',
    strokeLight: '#059669',
    textLight: '#065f46',
  },
  {
    key: 'none',
    label: 'Untracked',
    min: 0,
    gradientDark: 'url(#grad-none-dark)',
    strokeDark: '#475569',
    glowDark: 'transparent',
    gradientLight: 'url(#grad-none-light)',
    strokeLight: '#94a3b8',
    textLight: '#64748b',
  },
]

export const getRiskTier = (avgRisk: number, totalWorks: number): RiskTierConfig => {
  if (totalWorks === 0 && avgRisk === 0) return RISK_TIERS[4]
  for (const tier of RISK_TIERS.slice(0, 4)) {
    if (avgRisk >= tier.min) return tier
  }
  return RISK_TIERS[3]
}

// ──────────────────────────────────────────────────────────────
// Component Props
// ──────────────────────────────────────────────────────────────

export interface IndiaMapProps {
  stateSummaries: StateSummaryItem[]
  onSelectState?: (stateName: string) => void
  selectedState?: string | null
  className?: string
  height?: number
}

// National Overview Default ViewBox (perfect framing with top HUD headroom)
const DEFAULT_VIEWBOX = { x: 30, y: 15, w: 780, h: 920 }

export const IndiaMap: React.FC<IndiaMapProps> = ({
  stateSummaries = [],
  onSelectState,
  selectedState: externalSelectedState = null,
  className = '',
  height = 560,
}) => {
  // Theme & Perspective Modes
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true) // Luxury Obsidian Gold by default
  const [is3DMode, setIs3DMode] = useState<boolean>(true) // 3D Isometric Relief by default
  const [isEnlarged, setIsEnlarged] = useState<boolean>(false)

  // Interactive Selection & Zoom ("Make It Bigger" Engine)
  const [activeStateName, setActiveStateName] = useState<string | null>(externalSelectedState)
  const [viewBox, setViewBox] = useState(DEFAULT_VIEWBOX)
  const [hoveredState, setHoveredState] = useState<VectorState | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Filter & Search Controls
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showSearchList, setShowSearchList] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external selection
  useEffect(() => {
    if (externalSelectedState && externalSelectedState !== activeStateName) {
      handleFocusState(externalSelectedState)
    }
  }, [externalSelectedState])

  // Lookup map for fast O(1) state metrics
  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateSummaryItem>()
    stateSummaries.forEach((s) => {
      const norm = normalizeStateName(s.state)
      const keys = [
        s.state.toLowerCase(),
        norm.toLowerCase(),
        s.state.toLowerCase().replace(/&/g, 'and').trim(),
        s.state.toLowerCase().replace(/and/g, '&').trim(),
      ]
      keys.forEach((k) => map.set(k, s))
    })
    if (!map.has('andhra pradesh') && map.has('telangana')) {
      map.set('andhra pradesh', map.get('telangana')!)
    }
    return map
  }, [stateSummaries])

  // Helper to fetch metrics for a state
  const getSummary = useCallback(
    (name: string): { summary?: StateSummaryItem; displayName: string } => {
      const norm = normalizeStateName(name)
      const summary = stateDataMap.get(norm.toLowerCase()) || stateDataMap.get(name.toLowerCase())
      return { summary, displayName: norm }
    },
    [stateDataMap]
  )

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts = { all: stateSummaries.length, critical: 0, high: 0, medium: 0, low: 0, none: 0 }
    stateSummaries.forEach((s) => {
      const tier = getRiskTier(s.avg_risk, s.works)
      counts[tier.key as keyof typeof counts]++
    })
    return counts
  }, [stateSummaries])

  // Focused state details
  const focusedSummary = useMemo(() => {
    if (!activeStateName) return null
    return (
      stateDataMap.get(activeStateName.toLowerCase()) ||
      stateDataMap.get(normalizeStateName(activeStateName).toLowerCase()) ||
      null
    )
  }, [activeStateName, stateDataMap])

  // ────────────────────────────────────────────────────────────
  // ZOOM & ENLARGE STATE LOGIC ("Make It Bigger")
  // ────────────────────────────────────────────────────────────

  const handleFocusState = useCallback(
    (stateName: string) => {
      const stateObj = mapPathsData.find(
        (s) =>
          s.name.toLowerCase() === stateName.toLowerCase() ||
          normalizeStateName(s.name).toLowerCase() === normalizeStateName(stateName).toLowerCase()
      )

      if (!stateObj) {
        setActiveStateName(stateName)
        return
      }

      setActiveStateName(stateObj.name)

      // Calculate Bounding Box with luxury framing padding
      const [[minX, minY], [maxX, maxY]] = stateObj.bounds
      const width = Math.max(1, maxX - minX)
      const height = Math.max(1, maxY - minY)

      // Add proportional padding and offset slightly to the left to seat alongside the Dossier HUD
      const pad = Math.max(width, height) * 0.32
      const targetW = width + pad * 2.1
      const targetH = height + pad * 1.9
      const targetX = minX - pad * 0.55
      const targetY = minY - pad * 0.75

      // Smoothly morph ViewBox to make the clicked state enormous!
      setViewBox({
        x: Math.round(targetX),
        y: Math.round(targetY),
        w: Math.round(targetW),
        h: Math.round(targetH),
      })
    },
    []
  )

  const handleResetNationalView = useCallback(() => {
    setActiveStateName(null)
    setViewBox(DEFAULT_VIEWBOX)
    setTierFilter('all')
    setSearchQuery('')
    setShowSearchList(false)
  }, [])

  // Search filter list
  const filteredSearchList = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return mapPathsData.filter(
      (s) => s.name.toLowerCase().includes(q) || normalizeStateName(s.name).toLowerCase().includes(q)
    )
  }, [searchQuery])

  // Track mouse for floating cursor tooltip
  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  // Effective container height
  const stageHeight = isEnlarged ? Math.max(height, 760) : height

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`prahar-classic-cartography-stage ${isDarkTheme ? 'theme-obsidian' : 'theme-ivory'} ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: `${stageHeight}px`,
        borderRadius: 24,
        overflow: 'hidden',
        background: isDarkTheme
          ? 'radial-gradient(ellipse at 50% 30%, #0d1a33 0%, #060c18 60%, #03060d 100%)'
          : 'radial-gradient(ellipse at 50% 25%, #ffffff 0%, #f4f7fa 70%, #e9eef4 100%)',
        border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid #dbe2ea',
        boxShadow: isDarkTheme
          ? '0 20px 50px rgba(0, 0, 0, 0.7), inset 0 0 100px rgba(13, 26, 51, 0.5)'
          : '0 12px 40px rgba(15, 23, 42, 0.08), inset 0 0 60px rgba(255, 255, 255, 0.8)',
        transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
        userSelect: 'none',
      }}
    >
      {/* ────────────────────────────────────────────────────────────── */}
      {/* BACKGROUND TOPOGRAPHIC & AESTHETIC COMPASS GRID */}
      {/* ────────────────────────────────────────────────────────────── */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: isDarkTheme ? 0.35 : 0.45,
        }}
      >
        <defs>
          <pattern id="carto-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={isDarkTheme ? 'rgba(56, 189, 248, 0.12)' : 'rgba(100, 116, 139, 0.15)'}
              strokeWidth="0.8"
            />
            <circle
              cx="0"
              cy="0"
              r="1.2"
              fill={isDarkTheme ? 'rgba(245, 158, 11, 0.35)' : 'rgba(30, 41, 59, 0.25)'}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#carto-grid)" />
      </svg>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* CLASSIC CARTOGRAPHIC HEADER & CONTROLS HUD */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 18,
          right: 18,
          zIndex: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        {/* Left: Classic Seal & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 14px',
              borderRadius: 30,
              background: isDarkTheme ? 'rgba(6, 12, 24, 0.88)' : 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #cbd5e1',
              boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
            }}
          >
            <Compass size={15} color={isDarkTheme ? '#f59e0b' : '#1e3a8a'} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: isDarkTheme ? '#fbbf24' : '#0f172a',
                  fontFamily: "'Outfit', 'Cinzel', serif",
                  textTransform: 'uppercase',
                }}
              >
                PRAHAR Geospatial Cartography
              </span>
              <span style={{ fontSize: '9px', color: isDarkTheme ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                {activeStateName ? `Focused View: ${activeStateName}` : 'All-India National Overview'}
              </span>
            </div>
          </div>

          {/* Quick State Search */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 24,
                background: isDarkTheme ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(14px)',
                border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            >
              <Search size={13} color={isDarkTheme ? '#94a3b8' : '#64748b'} />
              <input
                type="text"
                placeholder="Find state to enlarge..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSearchList(true)
                }}
                onFocus={() => setShowSearchList(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: isDarkTheme ? '#f8fafc' : '#0f172a',
                  width: '150px',
                  fontFamily: "'Inter', sans-serif",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Dropdown list */}
            {showSearchList && filteredSearchList.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '115%',
                  left: 0,
                  width: '230px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  borderRadius: 14,
                  background: isDarkTheme ? '#0b1325' : '#ffffff',
                  border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #cbd5e1',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.35)',
                  zIndex: 2000,
                  padding: '6px',
                }}
              >
                {filteredSearchList.map((state) => (
                  <div
                    key={state.name}
                    onClick={() => {
                      handleFocusState(state.name)
                      setSearchQuery('')
                      setShowSearchList(false)
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: isDarkTheme ? '#f1f5f9' : '#1e293b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDarkTheme ? 'rgba(56, 189, 248, 0.15)' : '#f1f5f9'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span>{state.name}</span>
                    <ChevronRight size={13} color="#f59e0b" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Integrated Cartographic HUD Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'auto',
            flexWrap: 'nowrap',
          }}
        >
          {/* Reset Zoom Button */}
          {activeStateName && (
            <button
              onClick={handleResetNationalView}
              title="Reset View to All-India National Map"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 20,
                background: isDarkTheme ? 'rgba(245, 158, 11, 0.22)' : '#eff6ff',
                border: isDarkTheme ? '1px solid #f59e0b' : '1px solid #93c5fd',
                color: isDarkTheme ? '#fde047' : '#1d4ed8',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
                boxShadow: isDarkTheme ? '0 0 14px rgba(245, 158, 11, 0.3)' : '0 2px 8px rgba(29, 78, 216, 0.15)',
                transition: 'all 0.2s ease',
              }}
            >
              <RotateCcw size={12} />
              <span>Full View</span>
            </button>
          )}

          {/* 3D Isometric Relief Toggle */}
          <button
            onClick={() => setIs3DMode(!is3DMode)}
            title={is3DMode ? 'Switch to 2D Planar Map' : 'Switch to 3D Isometric Relief Map'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 11px',
              borderRadius: 20,
              background: is3DMode
                ? isDarkTheme
                  ? 'rgba(56, 189, 248, 0.2)'
                  : '#dbeafe'
                : isDarkTheme
                ? 'rgba(15, 23, 42, 0.85)'
                : 'rgba(255, 255, 255, 0.92)',
              border: is3DMode
                ? isDarkTheme
                  ? '1px solid #38bdf8'
                  : '1px solid #3b82f6'
                : isDarkTheme
                ? '1px solid rgba(255, 255, 255, 0.12)'
                : '1px solid #cbd5e1',
              color: is3DMode ? (isDarkTheme ? '#38bdf8' : '#1d4ed8') : isDarkTheme ? '#cbd5e1' : '#475569',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <Layers size={12} />
            <span>{is3DMode ? '3D' : '2D'}</span>
          </button>

          {/* Theme Toggle (Classic Obsidian / Ivory) */}
          <button
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            title={isDarkTheme ? 'Switch to Ivory Architectural Day Theme' : 'Switch to Royal Obsidian Night Theme'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: isDarkTheme ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.92)',
              border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
              color: isDarkTheme ? '#fbbf24' : '#475569',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {isDarkTheme ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Enlarge Stage Toggle */}
          <button
            onClick={() => setIsEnlarged(!isEnlarged)}
            title={isEnlarged ? 'Compact View' : 'Enlarge Map Stage'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 20,
              background: isEnlarged
                ? '#f59e0b'
                : isDarkTheme
                ? 'rgba(15, 23, 42, 0.85)'
                : 'rgba(255, 255, 255, 0.92)',
              border: isEnlarged
                ? '1px solid #f59e0b'
                : isDarkTheme
                ? '1px solid rgba(255, 255, 255, 0.15)'
                : '1px solid #cbd5e1',
              color: isEnlarged ? '#050a14' : isDarkTheme ? '#f1f5f9' : '#0f172a',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              transition: 'all 0.2s ease',
            }}
          >
            {isEnlarged ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{isEnlarged ? 'Compact' : 'Enlarge'}</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* 3D VECTOR SVG CARTOGRAPHY STAGE */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: is3DMode ? '1200px' : 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: is3DMode
              ? activeStateName
                ? 'perspective(1200px) rotateX(10deg) rotateZ(-1deg) scale(1.02)'
                : 'perspective(1200px) rotateX(16deg) rotateZ(-2.5deg) translateY(-14px)'
              : 'none',
            transformOrigin: '50% 50%',
            transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
          }}
        >
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            style={{
              width: '100%',
              height: '100%',
              transition: 'all 1.0s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* SVG Gradients & Lighting Filters for High-End 3D Visual Depth */}
            <defs>
              {/* Obsidian Night Theme Jewel Gradients */}
              <linearGradient id="grad-critical-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#be123c" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
              <linearGradient id="grad-high-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#9a3412" />
              </linearGradient>
              <linearGradient id="grad-medium-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
              <linearGradient id="grad-low-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id="grad-none-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              {/* Ivory Day Theme Gradients */}
              <linearGradient id="grad-critical-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
              <linearGradient id="grad-high-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>
              <linearGradient id="grad-medium-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#facc15" />
              </linearGradient>
              <linearGradient id="grad-low-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="grad-none-light" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>

              {/* 3D Isometric Drop Shadow Filter */}
              <filter id="carto-shadow" x="-20%" y="-20%" width="150%" height="150%">
                <feDropShadow
                  dx="0"
                  dy={is3DMode ? '8' : '3'}
                  stdDeviation={is3DMode ? '6' : '3'}
                  floodColor={isDarkTheme ? '#000000' : '#0f172a'}
                  floodOpacity={isDarkTheme ? '0.65' : '0.15'}
                />
              </filter>

              {/* Selected State Holographic Glow Filter */}
              <filter id="hero-glow" x="-30%" y="-30%" width="170%" height="170%">
                <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#f59e0b" floodOpacity="0.8" />
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.9" />
              </filter>
            </defs>

            {/* Ambient Background India Outline Glow */}
            <g id="states-group" filter="url(#carto-shadow)">
              {mapPathsData.map((state) => {
                const { summary, displayName } = getSummary(state.name)
                const risk = summary ? summary.avg_risk : 0
                const works = summary ? summary.works : 0
                const tier = getRiskTier(risk, works)

                const isSelected =
                  activeStateName &&
                  (displayName.toLowerCase().includes(activeStateName.toLowerCase()) ||
                    activeStateName.toLowerCase().includes(displayName.toLowerCase()))

                const isHovered =
                  hoveredState &&
                  (displayName.toLowerCase() === hoveredState.name.toLowerCase() ||
                    hoveredState.name.toLowerCase() === displayName.toLowerCase())

                const matchesFilter =
                  tierFilter === 'all' ||
                  (tierFilter === 'critical' && tier.key === 'critical') ||
                  (tierFilter === 'high' && tier.key === 'high') ||
                  (tierFilter === 'medium' && tier.key === 'medium') ||
                  (tierFilter === 'low' && tier.key === 'low') ||
                  (tierFilter === 'none' && tier.key === 'none')

                // Dynamic opacity & spotlight depth of field
                let opacity = 1
                if (activeStateName) {
                  opacity = isSelected ? 1 : isDarkTheme ? 0.18 : 0.22
                } else if (!matchesFilter) {
                  opacity = isDarkTheme ? 0.15 : 0.25
                }

                // Stroke color & width
                const strokeColor = isSelected
                  ? '#f59e0b'
                  : isHovered
                  ? isDarkTheme
                    ? '#38bdf8'
                    : '#1d4ed8'
                  : isDarkTheme
                  ? tier.strokeDark
                  : tier.strokeLight

                const strokeWidth = isSelected ? 4 : isHovered ? 2.8 : matchesFilter ? 1.4 : 0.8

                const fillColor = isDarkTheme ? tier.gradientDark : tier.gradientLight

                return (
                  <path
                    key={state.id || state.name}
                    id={`state-path-${state.name.replace(/\s+/g, '-')}`}
                    d={state.path}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={opacity}
                    filter={isSelected ? 'url(#hero-glow)' : undefined}
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                      transformOrigin: `${state.centroid[0]}px ${state.centroid[1]}px`,
                      transform: isHovered && !isSelected ? 'scale(1.02)' : isSelected ? 'scale(1.03)' : 'scale(1)',
                    }}
                    onClick={() => {
                      if (isSelected) {
                        handleResetNationalView()
                      } else {
                        handleFocusState(displayName)
                      }
                    }}
                    onMouseEnter={() => setHoveredState(state)}
                    onMouseLeave={() => setHoveredState(null)}
                  />
                )
              })}
            </g>

            {/* Centroid Beacons for High/Critical Risk States */}
            {mapPathsData.map((state) => {
              const { summary, displayName } = getSummary(state.name)
              if (!summary || summary.avg_risk < 50 || summary.works === 0) return null

              const isSelected = activeStateName?.toLowerCase() === displayName.toLowerCase()
              const tier = getRiskTier(summary.avg_risk, summary.works)
              const [cx, cy] = state.centroid

              return (
                <g
                  key={`beacon-${state.name}`}
                  transform={`translate(${cx}, ${cy})`}
                  style={{ cursor: 'pointer', pointerEvents: 'none' }}
                >
                  <circle
                    r={isSelected ? '14' : '9'}
                    fill="none"
                    stroke={tier.strokeDark}
                    strokeWidth="1.5"
                    opacity="0.8"
                  >
                    <animate attributeName="r" values="6;22" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle
                    r={isSelected ? '6' : '4.5'}
                    fill={tier.strokeDark}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    filter="drop-shadow(0 0 6px #f43f5e)"
                  />
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* FLOATING HOVER TOOLTIP HUD (Tracks cursor in real time) */}
      {/* ────────────────────────────────────────────────────────────── */}
      {hoveredState && !activeStateName && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(mousePos.x + 18, (containerRef.current?.clientWidth || 800) - 240),
            top: Math.min(mousePos.y + 18, (containerRef.current?.clientHeight || 600) - 180),
            zIndex: 100,
            pointerEvents: 'none',
            minWidth: '220px',
            borderRadius: 14,
            background: isDarkTheme ? 'rgba(6, 12, 24, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(16px)',
            border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid #cbd5e1',
            boxShadow: isDarkTheme ? '0 12px 30px rgba(0,0,0,0.5)' : '0 10px 25px rgba(15,23,42,0.1)',
            padding: '10px 14px',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            animation: 'tooltip-pop 0.15s ease',
          }}
        >
          {(() => {
            const { summary, displayName } = getSummary(hoveredState.name)
            const risk = summary ? summary.avg_risk : 0
            const works = summary ? summary.works : 0
            const exp = summary ? summary.expenditure_cr : 0
            const anomalies = summary ? summary.anomalies : 0
            const tier = getRiskTier(risk, works)

            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                    paddingBottom: 6,
                    borderBottom: isDarkTheme ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: '14px', color: isDarkTheme ? '#ffffff' : '#0f172a' }}>
                    {displayName}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: isDarkTheme ? `${tier.strokeDark}22` : '#f1f5f9',
                      color: isDarkTheme ? tier.strokeDark : tier.textLight,
                      border: `1px solid ${tier.strokeDark}44`,
                      textTransform: 'uppercase',
                    }}
                  >
                    {tier.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Risk Score</span>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: tier.strokeDark }}>
                      {risk} <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>/100</span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Projects</span>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>
                      {works.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Disbursed</span>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: '#10b981' }}>
                      ₹{exp.toFixed(1)} Cr
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Anomalies</span>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: anomalies > 0 ? '#ef4444' : '#10b981' }}>
                      {anomalies}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 6,
                    borderTop: isDarkTheme ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed #e2e8f0',
                    fontSize: '10px',
                    color: '#f59e0b',
                    fontWeight: 600,
                  }}
                >
                  ⚡ Click to zoom in & enlarge state details
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* EXPANDED STATE INTELLIGENCE DOSSIER (WHEN STATE IS CLICKED) */}
      {/* ────────────────────────────────────────────────────────────── */}
      {activeStateName && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 50,
            width: '315px',
            borderRadius: 18,
            background: isDarkTheme ? 'rgba(6, 12, 24, 0.96)' : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(24px)',
            border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid #bfdbfe',
            boxShadow: isDarkTheme
              ? '0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(245, 158, 11, 0.2)'
              : '0 16px 40px rgba(30, 58, 138, 0.12)',
            padding: '13px 15px',
            fontFamily: "'Outfit', 'Inter', sans-serif",
            animation: 'dossier-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: isDarkTheme ? '#f59e0b' : '#1d4ed8',
                  fontSize: '10px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 1,
                }}
              >
                <MapPin size={11} />
                <span>Magnified State Dossier</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: isDarkTheme ? '#ffffff' : '#0f172a' }}>
                {activeStateName}
              </div>
            </div>

            <button
              onClick={handleResetNationalView}
              title="Close & Reset Zoom"
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: isDarkTheme ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                border: 'none',
                color: isDarkTheme ? '#cbd5e1' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Body stats */}
          {focusedSummary ? (
            (() => {
              const tier = getRiskTier(focusedSummary.avg_risk, focusedSummary.works)
              const score = focusedSummary.avg_risk

              return (
                <>
                  {/* Strategic Tier Badge & Risk Gauge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 11px',
                      borderRadius: 12,
                      background: isDarkTheme ? 'rgba(2, 6, 23, 0.65)' : '#f8fafc',
                      border: isDarkTheme ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '9.5px', color: isDarkTheme ? '#94a3b8' : '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                        Audit Threat Assessment
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: tier.strokeDark, textTransform: 'uppercase' }}>
                        {tier.label}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: tier.strokeDark }}>
                        {score} <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Gauge */}
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        width: '100%',
                        height: 5,
                        borderRadius: 3,
                        background: isDarkTheme ? '#1e293b' : '#e2e8f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, score))}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, #10b981 0%, ${tier.strokeDark} 100%)`,
                          boxShadow: `0 0 10px ${tier.strokeDark}`,
                          transition: 'width 0.8s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* 4 Metric Pills */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 9,
                        background: isDarkTheme ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
                        border: isDarkTheme ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ fontSize: '9.5px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Parliamentary Works</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: isDarkTheme ? '#f8fafc' : '#0f172a' }}>
                        {focusedSummary.works.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 9,
                        background: isDarkTheme ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
                        border: isDarkTheme ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ fontSize: '9.5px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Disbursed Fund</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#10b981' }}>
                        ₹{focusedSummary.expenditure_cr.toFixed(1)} Cr
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 9,
                        background: isDarkTheme ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
                        border: isDarkTheme ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ fontSize: '9.5px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Anomalies Flagged</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: focusedSummary.anomalies > 0 ? '#ef4444' : '#10b981' }}>
                        {focusedSummary.anomalies}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '6px 8px',
                        borderRadius: 9,
                        background: isDarkTheme ? 'rgba(2, 6, 23, 0.45)' : '#f8fafc',
                        border: isDarkTheme ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ fontSize: '9.5px', color: isDarkTheme ? '#94a3b8' : '#64748b' }}>Constituencies</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>
                        {focusedSummary.constituencies}
                      </div>
                    </div>
                  </div>
                </>
              )
            })()
          ) : (
            <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
              No official expenditure data recorded for this territory.
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => {
                if (onSelectState) {
                  onSelectState(activeStateName)
                }
              }}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#050a14',
                border: 'none',
                fontWeight: 800,
                fontSize: '11.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Explore Constituencies</span>
              <ExternalLink size={12} />
            </button>

            <button
              onClick={handleResetNationalView}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: isDarkTheme ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                color: isDarkTheme ? '#cbd5e1' : '#475569',
                border: isDarkTheme ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                fontWeight: 700,
                fontSize: '11.5px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────── */}
      {/* CLASSIC LEGEND & TIER FILTER (Bottom-Left) */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 40,
          background: isDarkTheme ? 'rgba(6, 12, 24, 0.94)' : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          border: isDarkTheme ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #cbd5e1',
          borderRadius: 16,
          padding: '10px 14px',
          boxShadow: isDarkTheme ? '0 12px 30px rgba(0, 0, 0, 0.5)' : '0 8px 24px rgba(15, 23, 42, 0.08)',
          minWidth: 175,
          fontFamily: "'Outfit', 'Inter', sans-serif",
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: isDarkTheme ? '#fbbf24' : '#0f172a',
            }}
          >
            Risk Choropleth
          </span>
          <button
            onClick={() => setTierFilter('all')}
            title="Show All States"
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10,
              border: tierFilter === 'all'
                ? isDarkTheme
                  ? '1px solid #f59e0b'
                  : '1px solid #1e3a8a'
                : '1px solid transparent',
              background: tierFilter === 'all'
                ? isDarkTheme
                  ? 'rgba(245, 158, 11, 0.25)'
                  : '#eff6ff'
                : 'transparent',
              color: isDarkTheme ? '#fde047' : '#1d4ed8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            All 36 States
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {RISK_TIERS.slice(0, 4).map((tier) => {
            const count = tierCounts[tier.key as keyof typeof tierCounts]
            const isFilterActive = tierFilter === tier.key
            return (
              <div
                key={tier.key}
                onClick={() => setTierFilter(tierFilter === tier.key ? 'all' : tier.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: 7,
                  border: isFilterActive
                    ? isDarkTheme
                      ? `1px solid ${tier.strokeDark}`
                      : `1px solid ${tier.strokeLight}`
                    : '1px solid transparent',
                  background: isFilterActive
                    ? isDarkTheme
                      ? `${tier.strokeDark}25`
                      : '#eff6ff'
                    : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2.5,
                      background: tier.strokeDark,
                      boxShadow: `0 0 6px ${tier.strokeDark}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: isFilterActive ? 800 : 600,
                      color: isFilterActive
                        ? isDarkTheme
                          ? '#ffffff'
                          : '#0f172a'
                        : isDarkTheme
                        ? '#cbd5e1'
                        : '#334155',
                    }}
                  >
                    {tier.label} ({tier.min}+)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: isFilterActive ? tier.strokeDark : isDarkTheme ? '#94a3b8' : '#64748b',
                  }}
                >
                  {count}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* GEOSPATIAL TELEMETRY TICKER (Bottom Center) */}
      {/* ────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: activeStateName ? 380 : 18,
          zIndex: 35,
          fontSize: '10px',
          fontFamily: "'Courier New', Courier, monospace",
          color: isDarkTheme ? 'rgba(245, 158, 11, 0.7)' : '#64748b',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
          display: 'flex',
          gap: 14,
          transition: 'right 0.3s ease',
        }}
      >
        <span>LAT: 20.5937° N</span>
        <span>LON: 78.9629° E</span>
        <span>PROJ: MERCATOR EPSG:3857</span>
        <span style={{ color: '#10b981' }}>● GADM VECTOR 100% OK</span>
      </div>

      {/* Injected Keyframes */}
      <CartoStylesInjector />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Keyframe Animations Injector
// ──────────────────────────────────────────────────────────────

const CartoStylesInjector: React.FC = () => {
  useEffect(() => {
    const id = 'prahar-carto-styles'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = `
      @keyframes tooltip-pop {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes dossier-slide-in {
        from { transform: translateY(24px) scale(0.96); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
    `
    document.head.appendChild(el)
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [])
  return null
}

export default IndiaMap