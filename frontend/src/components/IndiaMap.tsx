import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined,
  PlusOutlined,
  MinusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  CompassOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { Select, Tag } from 'antd'
import { StateSummaryItem } from '../types'

interface IndiaMapProps {
  stateSummaries: StateSummaryItem[]
  onSelectState?: (stateName: string) => void
  selectedState?: string | null
  height?: number | string
}

export type MetricMode = 'risk' | 'anomalies' | 'expenditure' | 'works'
export type BasemapTheme = 'canvas' | 'carto' | 'dark'

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

// Centroids for tactical radar hotspots and smooth fly-to camera targeting
const STATE_CENTROIDS: Record<string, [number, number]> = {
  'Andhra Pradesh': [15.9129, 79.7400],
  'Arunachal Pradesh': [28.2180, 94.7278],
  'Assam': [26.2006, 92.9376],
  'Bihar': [25.0961, 85.3131],
  'Chhattisgarh': [21.2787, 81.8661],
  'Goa': [15.2993, 74.1240],
  'Gujarat': [22.2587, 71.1924],
  'Haryana': [29.0588, 76.0856],
  'Himachal Pradesh': [31.1048, 77.1734],
  'Jharkhand': [23.6102, 85.2799],
  'Karnataka': [15.3173, 75.7139],
  'Kerala': [10.8505, 76.2711],
  'Madhya Pradesh': [22.9734, 78.6569],
  'Maharashtra': [19.7515, 75.7139],
  'Manipur': [24.6637, 93.9063],
  'Meghalaya': [25.4670, 91.3662],
  'Mizoram': [23.1645, 92.9376],
  'Nagaland': [26.1584, 94.5624],
  'Odisha': [20.9517, 85.0985],
  'Punjab': [31.1471, 75.3412],
  'Rajasthan': [27.0238, 74.2179],
  'Sikkim': [27.5330, 88.5122],
  'Tamil Nadu': [11.1271, 78.6569],
  'Telangana': [18.1124, 79.0193],
  'Tripura': [23.9408, 91.9882],
  'Uttar Pradesh': [26.8467, 80.9462],
  'Uttarakhand': [30.0668, 79.0193],
  'West Bengal': [22.9868, 87.8550],
  'Delhi': [28.7041, 77.1025],
  'Jammu & Kashmir': [33.7782, 76.5762],
  'Ladakh': [34.1526, 77.5771],
  'Puducherry': [11.9416, 79.8083],
  'Chandigarh': [30.7333, 76.7794],
  'Andaman & Nicobar': [11.7401, 92.6586],
}

export const getRiskColor = (avgRisk: number, totalWorks: number = 0): string => {
  if (totalWorks === 0 && avgRisk === 0) return '#cbd5e1'
  if (avgRisk >= 75) return '#ef4444' // Critical
  if (avgRisk >= 50) return '#f97316' // High
  if (avgRisk >= 25) return '#f59e0b' // Medium
  return '#10b981'                     // Low
}

const getMetricColor = (
  mode: MetricMode,
  summary?: StateSummaryItem
): { fillColor: string; labelValue: string } => {
  if (!summary || (summary.works === 0 && summary.avg_risk === 0)) {
    return { fillColor: '#94a3b8', labelValue: 'No Data' }
  }

  if (mode === 'risk') {
    const risk = summary.avg_risk
    return {
      fillColor: getRiskColor(risk, summary.works),
      labelValue: `${risk} / 100`,
    }
  }

  if (mode === 'anomalies') {
    const a = summary.anomalies
    if (a >= 25) return { fillColor: '#e11d48', labelValue: `${a} anomalies` }
    if (a >= 15) return { fillColor: '#9333ea', labelValue: `${a} anomalies` }
    if (a >= 8) return { fillColor: '#a855f7', labelValue: `${a} anomalies` }
    if (a >= 3) return { fillColor: '#0284c7', labelValue: `${a} anomalies` }
    if (a >= 1) return { fillColor: '#38bdf8', labelValue: `${a} anomalies` }
    return { fillColor: '#10b981', labelValue: '0 anomalies' }
  }

  if (mode === 'expenditure') {
    const exp = summary.expenditure_cr
    if (exp >= 350) return { fillColor: '#064e3b', labelValue: `₹${exp.toFixed(1)} Cr` }
    if (exp >= 200) return { fillColor: '#047857', labelValue: `₹${exp.toFixed(1)} Cr` }
    if (exp >= 100) return { fillColor: '#10b981', labelValue: `₹${exp.toFixed(1)} Cr` }
    if (exp >= 40) return { fillColor: '#34d399', labelValue: `₹${exp.toFixed(1)} Cr` }
    return { fillColor: '#a7f3d0', labelValue: `₹${exp.toFixed(1)} Cr` }
  }

  // mode === 'works'
  const w = summary.works
  if (w >= 3000) return { fillColor: '#1e3a8a', labelValue: `${w.toLocaleString()} works` }
  if (w >= 1500) return { fillColor: '#1d4ed8', labelValue: `${w.toLocaleString()} works` }
  if (w >= 800) return { fillColor: '#2563eb', labelValue: `${w.toLocaleString()} works` }
  if (w >= 300) return { fillColor: '#60a5fa', labelValue: `${w.toLocaleString()} works` }
  return { fillColor: '#bfdbfe', labelValue: `${w.toLocaleString()} works` }
}

// Beacon icon for top anomaly epicenters
const createPulseBeaconIcon = (tier: 'critical' | 'high', anomalies: number) => {
  const color = tier === 'critical' ? '#ef4444' : '#f97316'
  return L.divIcon({
    className: 'tactical-radar-beacon',
    html: `
      <div class="beacon-shell" style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid ${color}; opacity: 0.9; animation: radarPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="position: absolute; width: 100%; height: 100%; border-radius: 50%; border: 2px solid ${color}; opacity: 0.7; animation: radarPing 2.2s cubic-bezier(0, 0, 0.2, 1) infinite 0.75s;"></span>
        <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 10px ${color}, 0 0 2px #ffffff; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center;">
          <span style="width: 3px; height: 3px; border-radius: 50%; background: #ffffff;"></span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

// Internal map controller for zoom & reset view
interface MapControllerProps {
  defaultCenter: [number, number]
  defaultZoom: number
  targetCoords: [number, number] | null
  resetTrigger: number
  zoomInTrigger: number
  zoomOutTrigger: number
}

const MapCameraController: React.FC<MapControllerProps> = ({
  defaultCenter,
  defaultZoom,
  targetCoords,
  resetTrigger,
  zoomInTrigger,
  zoomOutTrigger,
}) => {
  const map = useMap()

  useEffect(() => {
    if (resetTrigger > 0) {
      map.flyTo(defaultCenter, defaultZoom, { duration: 1.1, easeLinearity: 0.25 })
    }
  }, [resetTrigger, defaultCenter, defaultZoom, map])

  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 6.2, { duration: 1.1, easeLinearity: 0.25 })
    }
  }, [targetCoords, map])

  useEffect(() => {
    if (zoomInTrigger > 0) {
      map.zoomIn(0.5)
    }
  }, [zoomInTrigger, map])

  useEffect(() => {
    if (zoomOutTrigger > 0) {
      map.zoomOut(0.5)
    }
  }, [zoomOutTrigger, map])

  return null
}

export const IndiaMap: React.FC<IndiaMapProps> = ({
  stateSummaries,
  onSelectState,
  selectedState,
  height = 560,
}) => {
  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [metricMode, setMetricMode] = useState<MetricMode>('risk')
  const [basemapTheme, setBasemapTheme] = useState<BasemapTheme>('canvas')
  const [showRadarHotspots, setShowRadarHotspots] = useState(true)
  const [filterTier, setFilterTier] = useState<string | null>(null)
  const [hoveredState, setHoveredState] = useState<{
    summary?: StateSummaryItem
    displayName: string
  } | null>(null)
  const [isHudPinned, setIsHudPinned] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [targetCoords, setTargetCoords] = useState<[number, number] | null>(null)
  const [resetTrigger, setResetTrigger] = useState(0)
  const [zoomInTrigger, setZoomInTrigger] = useState(0)
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0)

  // 10% boosted default zoom from 4.3 -> 4.73
  const DEFAULT_ZOOM = 4.73
  // Center adjusted to latitude 21.8, longitude 81.5 so entire India fits seamlessly
  const DEFAULT_CENTER: [number, number] = [21.8, 81.5]

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/india.geojson')
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load india.geojson', err)
        setLoading(false)
      })
  }, [])

  const stateDataMap = useMemo(() => {
    const map = new Map<string, StateSummaryItem>()
    stateSummaries.forEach((s) => {
      map.set(s.state.toLowerCase(), s)
      map.set(s.state.toLowerCase().replace(/&/g, 'and').trim(), s)
      map.set(s.state.toLowerCase().replace(/and/g, '&').trim(), s)
      const norm = normalizeStateName(s.state)
      map.set(norm.toLowerCase(), s)
    })
    // Support pre-2014 Andhra Pradesh polygon with Telangana data fallback
    if (!map.has('andhra pradesh') && map.has('telangana')) {
      map.set('andhra pradesh', map.get('telangana')!)
    }
    return map
  }, [stateSummaries])

  // Key to re-mount Leaflet GeoJSON layer when summaries or metric mode changes
  const geoJsonKey = useMemo(
    () => `${metricMode}|${filterTier || 'all'}|${basemapTheme}|` +
      stateSummaries.map((s) => `${s.state}:${s.avg_risk}:${s.anomalies}`).join('|'),
    [metricMode, filterTier, basemapTheme, stateSummaries]
  )

  const getSummaryForFeature = useCallback((rawName: string): { summary?: StateSummaryItem; displayName: string } => {
    const normName = normalizeStateName(rawName)
    let summary = stateDataMap.get(normName.toLowerCase()) || stateDataMap.get(rawName.toLowerCase())
    let displayName = normName
    if (!summary && normName.toLowerCase() === 'andhra pradesh' && stateDataMap.has('telangana')) {
      summary = stateDataMap.get('telangana')
      displayName = 'Telangana & Andhra Pradesh'
    }
    return { summary, displayName }
  }, [stateDataMap])

  // Tactical Radar Beacons: Top 5 threat epicenters to avoid clutter
  const hotspotBeacons = useMemo(() => {
    if (!showRadarHotspots) return []

    // Sort by anomalies descending and avg_risk descending
    const sorted = [...stateSummaries]
      .filter((s) => s.avg_risk >= 75 || s.anomalies > 0)
      .sort((a, b) => (b.avg_risk * 10 + b.anomalies) - (a.avg_risk * 10 + a.anomalies))
      .slice(0, 5)

    const hotspots: Array<{
      state: string
      coords: [number, number]
      tier: 'critical' | 'high'
      anomalies: number
      risk: number
    }> = []

    sorted.forEach((s) => {
      const coords = STATE_CENTROIDS[s.state] || STATE_CENTROIDS[normalizeStateName(s.state)]
      if (!coords) return
      hotspots.push({
        state: s.state,
        coords,
        tier: s.avg_risk >= 75 ? 'critical' : 'high',
        anomalies: s.anomalies,
        risk: s.avg_risk,
      })
    })

    return hotspots
  }, [stateSummaries, showRadarHotspots])

  // National aggregated statistics
  const nationalStats = useMemo(() => {
    let criticalCount = 0
    let highCount = 0
    let medCount = 0
    let lowCount = 0
    let totalAnomalies = 0
    let totalExpenditure = 0

    stateSummaries.forEach((s) => {
      if (s.avg_risk >= 75) criticalCount++
      else if (s.avg_risk >= 50) highCount++
      else if (s.avg_risk >= 25) medCount++
      else if (s.works > 0) lowCount++
      totalAnomalies += s.anomalies || 0
      totalExpenditure += s.expenditure_cr || 0
    })

    return {
      criticalCount,
      highCount,
      medCount,
      lowCount,
      totalAnomalies,
      totalExpenditure,
      totalStates: stateSummaries.length,
    }
  }, [stateSummaries])

  const styleFeature = useCallback((feature: any) => {
    const rawName = feature.properties?.NAME_1 || feature.properties?.name || ''
    const { summary, displayName } = getSummaryForFeature(rawName)

    const isSelected = selectedState && (
      displayName.toLowerCase().includes(selectedState.toLowerCase()) ||
      selectedState.toLowerCase().includes(displayName.toLowerCase())
    )

    const isHovered = hoveredState && (
      displayName.toLowerCase() === hoveredState.displayName.toLowerCase()
    )

    const risk = summary ? summary.avg_risk : 0
    const works = summary ? summary.works : 0

    // Filter tier active dimming
    let isTierMatch = true
    if (filterTier) {
      if (filterTier === 'critical') isTierMatch = risk >= 75
      else if (filterTier === 'high') isTierMatch = risk >= 50 && risk < 75
      else if (filterTier === 'medium') isTierMatch = risk >= 25 && risk < 50
      else if (filterTier === 'low') isTierMatch = works > 0 && risk < 25
      else if (filterTier === 'nodata') isTierMatch = works === 0 && risk === 0
    }

    const { fillColor } = getMetricColor(metricMode, summary)

    const isDark = basemapTheme === 'dark'

    let borderStroke = isDark ? '#334155' : '#ffffff'
    let strokeWidth = isDark ? 1.0 : 1.3
    let opacity = 1
    let fillOpacity = isDark ? 0.88 : (works > 0 ? 0.84 : 0.45)

    if (!isTierMatch) {
      fillOpacity = 0.15
      opacity = 0.3
      borderStroke = isDark ? '#1e293b' : '#e2e8f0'
    } else if (isSelected || isHovered) {
      borderStroke = isDark ? '#38bdf8' : '#2563eb'
      strokeWidth = 2.6
      fillOpacity = 0.98
    }

    return {
      fillColor: fillColor,
      weight: strokeWidth,
      opacity: opacity,
      color: borderStroke,
      fillOpacity: fillOpacity,
    }
  }, [getSummaryForFeature, selectedState, hoveredState, filterTier, metricMode, basemapTheme])

  const onEachFeature = useCallback((feature: any, layer: any) => {
    const rawName = feature.properties?.NAME_1 || feature.properties?.name || 'Unknown'
    const { summary, displayName } = getSummaryForFeature(rawName)

    const risk = summary ? summary.avg_risk : 0
    const works = summary ? summary.works : 0
    const anomalies = summary ? summary.anomalies : 0
    const highRisk = summary ? summary.high_risk : 0
    const expenditure = summary ? summary.expenditure_cr : 0

    const tier = risk >= 75 ? 'CRITICAL' : risk >= 50 ? 'HIGH' : risk >= 25 ? 'MEDIUM' : works > 0 ? 'LOW' : 'NO DATA'
    const tierColor = getRiskColor(risk, works)

    // Sleek Leaflet hover tooltip
    layer.bindTooltip(
      `<div style="font-family: Inter, -apple-system, sans-serif; font-size: 12px; min-width: 185px; color: #0f172a; padding: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px;">
          <strong style="font-size: 13px; font-weight: 700; color: #0f172a;">${displayName}</strong>
          <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff; background: ${tierColor}; padding: 1px 6px; border-radius: 4px;">${tier}</span>
        </div>
        <div style="color: #475569; font-size: 11.5px; line-height: 1.65;">
          <div style="display: flex; justify-content: space-between;">
            <span>Risk Score:</span>
            <strong style="color: ${tierColor}; font-weight: 700;">${risk} / 100</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Active Anomalies:</span>
            <strong style="color: ${anomalies > 0 ? '#dc2626' : '#64748b'};">${anomalies}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>High Risk Constituencies:</span>
            <strong style="color: ${highRisk > 0 ? '#ea580c' : '#64748b'};">${highRisk}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Expenditure:</span>
            <strong style="color: #15803d;">₹${expenditure.toFixed(2)} Cr</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Works:</span>
            <strong style="color: #0f172a;">${works.toLocaleString()}</strong>
          </div>
        </div>
        <div style="margin-top: 7px; padding-top: 4px; border-top: 1px dashed #e2e8f0; font-size: 10px; color: #2563eb; font-weight: 600; text-align: right;">
          Click to inspect dossier →
        </div>
      </div>`,
      {
        className: 'leaflet-tooltip-immersive',
        sticky: true,
        direction: 'auto',
        opacity: 0.98,
      }
    )

    layer.on({
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          weight: 2.8,
          color: basemapTheme === 'dark' ? '#38bdf8' : '#2563eb',
          fillOpacity: 0.98,
        })
        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
          l.bringToFront()
        }
        setHoveredState({ summary, displayName })
      },
      mouseout: (e: any) => {
        const l = e.target
        l.setStyle(styleFeature(feature))
        if (!isHudPinned) {
          setHoveredState(null)
        }
      },
      click: () => {
        const targetState = summary ? summary.state : displayName
        if (onSelectState) {
          onSelectState(targetState)
        }
      },
    })
  }, [getSummaryForFeature, basemapTheme, styleFeature, onSelectState, isHudPinned])

  const handleStateSelect = (stateName: string) => {
    const coords = STATE_CENTROIDS[stateName] || STATE_CENTROIDS[normalizeStateName(stateName)]
    if (coords) {
      setTargetCoords(coords)
    }
    const summary = stateDataMap.get(stateName.toLowerCase())
    setHoveredState({ summary, displayName: stateName })
    setIsHudPinned(true)
  }

  const handleResetView = () => {
    setResetTrigger((prev) => prev + 1)
    setHoveredState(null)
    setIsHudPinned(false)
    setFilterTier(null)
    setTargetCoords(null)
  }

  if (loading || !geoData) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
          borderRadius: 16,
          color: '#475569',
          border: '1px solid #e2e8f0',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative', width: 44, height: 44 }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid #3b82f6',
              opacity: 0.3,
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: '#2563eb',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          Loading India Risk Choropleth Map...
        </span>
      </div>
    )
  }

  const isDark = basemapTheme === 'dark'

  return (
    <div
      ref={containerRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : height,
        zIndex: isFullscreen ? 99999 : 1,
        borderRadius: isFullscreen ? 0 : 16,
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 2px 12px rgba(0, 0, 0, 0.04)',
        background: isDark
          ? '#0b0f19'
          : basemapTheme === 'canvas'
          ? 'radial-gradient(circle at 50% 45%, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%)'
          : '#f1f5f9',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Self-contained CSS animations and Leaflet enhancements */}
      <style>{`
        @keyframes radarPing {
          0% { transform: scale(0.6); opacity: 0.95; }
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .leaflet-container {
          font-family: Inter, -apple-system, sans-serif !important;
        }
        .leaflet-tooltip-immersive {
          background: rgba(255, 255, 255, 0.96) !important;
          backdrop-filter: blur(10px) !important;
          border: 1px solid rgba(226, 232, 240, 0.9) !important;
          border-radius: 10px !important;
          padding: 8px 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
        }
        .leaflet-tooltip-immersive:before {
          border-top-color: rgba(255, 255, 255, 0.96) !important;
        }
        .prahar-map-vector-layer {
          filter: drop-shadow(0 10px 24px rgba(15, 23, 42, 0.14));
        }
        .prahar-map-vector-layer-dark {
          filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.65));
        }
      `}</style>

      {/* 1. Top Controls Bar: Metric Switcher & Navigation tools */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        {/* Metric Selector Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            borderRadius: 10,
            padding: '3px',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => setMetricMode('risk')}
            style={{
              background: metricMode === 'risk' ? '#ef4444' : 'transparent',
              color: metricMode === 'risk' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
              border: 'none',
              borderRadius: 7,
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ThunderboltOutlined style={{ fontSize: 10 }} />
            Risk
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('anomalies')}
            style={{
              background: metricMode === 'anomalies' ? '#8b5cf6' : 'transparent',
              color: metricMode === 'anomalies' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
              border: 'none',
              borderRadius: 7,
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ExclamationCircleOutlined style={{ fontSize: 10 }} />
            Anomalies
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('expenditure')}
            style={{
              background: metricMode === 'expenditure' ? '#10b981' : 'transparent',
              color: metricMode === 'expenditure' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
              border: 'none',
              borderRadius: 7,
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ₹ Outlay
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('works')}
            style={{
              background: metricMode === 'works' ? '#2563eb' : 'transparent',
              color: metricMode === 'works' ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569'),
              border: 'none',
              borderRadius: 7,
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <BarChartOutlined style={{ fontSize: 10 }} />
            Works
          </button>
        </div>

        {/* Quick Search State Dropdown */}
        <Select
          showSearch
          placeholder="Jump to State..."
          optionFilterProp="label"
          style={{ width: 130 }}
          size="small"
          suffixIcon={<SearchOutlined style={{ color: '#94a3b8' }} />}
          onChange={handleStateSelect}
          options={stateSummaries.map((s) => ({
            value: s.state,
            label: s.state,
          }))}
          styles={{
            popup: {
              root: {
                zIndex: 10001,
              },
            },
          }}
        />

        {/* Basemap Switcher */}
        <button
          type="button"
          onClick={() => {
            if (basemapTheme === 'canvas') setBasemapTheme('carto')
            else if (basemapTheme === 'carto') setBasemapTheme('dark')
            else setBasemapTheme('canvas')
          }}
          title={`Layer style: ${basemapTheme}. Click to cycle.`}
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            color: isDark ? '#38bdf8' : '#334155',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}
        >
          <GlobalOutlined />
          <span>{basemapTheme === 'canvas' ? 'Canvas' : basemapTheme === 'carto' ? 'Carto' : 'Dark'}</span>
        </button>

        {/* Hotspot Radar Toggle */}
        <button
          type="button"
          onClick={() => setShowRadarHotspots((prev) => !prev)}
          title="Toggle radar hotspot epicenters"
          style={{
            background: showRadarHotspots
              ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2')
              : (isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)'),
            color: showRadarHotspots ? '#ef4444' : (isDark ? '#94a3b8' : '#64748b'),
            border: showRadarHotspots
              ? '1px solid rgba(239, 68, 68, 0.4)'
              : (isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0'),
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <CompassOutlined />
          <span>Radar</span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={() => setIsFullscreen((prev) => !prev)}
          title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          style={{
            background: isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            color: isDark ? '#e2e8f0' : '#334155',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
        </button>
      </div>

      {/* 2. Floating Live State Inspector / HUD (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          zIndex: 1000,
          background: isDark ? 'rgba(11, 15, 25, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(226, 232, 240, 0.95)',
          boxShadow: isDark
            ? '0 12px 32px rgba(0, 0, 0, 0.55)'
            : '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          borderRadius: 12,
          padding: hoveredState ? '10px 12px' : '6px 10px',
          width: hoveredState ? 245 : 'auto',
          pointerEvents: 'auto',
          transition: 'all 0.2s ease',
        }}
      >
        {hoveredState ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: '13px' }}>🇮🇳</span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 130,
                  }}
                >
                  {hoveredState.displayName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {hoveredState.summary && (
                  <Tag
                    color={
                      hoveredState.summary.avg_risk >= 75
                        ? 'red'
                        : hoveredState.summary.avg_risk >= 50
                        ? 'orange'
                        : hoveredState.summary.avg_risk >= 25
                        ? 'gold'
                        : 'green'
                    }
                    style={{
                      borderRadius: 4,
                      fontSize: '9.5px',
                      fontWeight: 700,
                      margin: 0,
                      padding: '0 5px',
                    }}
                  >
                    {hoveredState.summary.avg_risk >= 75
                      ? 'CRITICAL'
                      : hoveredState.summary.avg_risk >= 50
                      ? 'HIGH'
                      : hoveredState.summary.avg_risk >= 25
                      ? 'MED'
                      : 'LOW'}
                  </Tag>
                )}
                {isHudPinned && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsHudPinned(false)
                      setHoveredState(null)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      fontSize: '11px',
                    }}
                  >
                    <CloseOutlined />
                  </button>
                )}
              </div>
            </div>

            {/* Risk Meter Bar */}
            {hoveredState.summary && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: 2 }}>
                  <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Risk Score</span>
                  <span style={{ fontWeight: 700, color: getRiskColor(hoveredState.summary.avg_risk, hoveredState.summary.works) }}>
                    {hoveredState.summary.avg_risk} / 100
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, background: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${hoveredState.summary.avg_risk}%`,
                      height: '100%',
                      background: getRiskColor(hoveredState.summary.avg_risk, hoveredState.summary.works),
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 2x2 Mini Metric Grid */}
            {hoveredState.summary ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                    borderRadius: 6,
                    padding: '4px 6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #edf2f7',
                  }}
                >
                  <div style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b' }}>Anomalies</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: hoveredState.summary.anomalies > 0 ? '#ef4444' : '#10b981' }}>
                    {hoveredState.summary.anomalies}
                  </div>
                </div>
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                    borderRadius: 6,
                    padding: '4px 6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #edf2f7',
                  }}
                >
                  <div style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b' }}>High Risk P.C.</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: hoveredState.summary.high_risk > 0 ? '#f97316' : '#64748b' }}>
                    {hoveredState.summary.high_risk}
                  </div>
                </div>
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                    borderRadius: 6,
                    padding: '4px 6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #edf2f7',
                  }}
                >
                  <div style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b' }}>Works</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#e2e8f0' : '#0f172a' }}>
                    {hoveredState.summary.works.toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                    borderRadius: 6,
                    padding: '4px 6px',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #edf2f7',
                  }}
                >
                  <div style={{ fontSize: '9.5px', color: isDark ? '#94a3b8' : '#64748b' }}>Disbursed</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>
                    ₹{hoveredState.summary.expenditure_cr.toFixed(1)} Cr
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '10.5px', color: '#94a3b8', margin: '4px 0' }}>
                No active records mapped.
              </div>
            )}

            {/* Drill Down Action */}
            <button
              type="button"
              onClick={() => {
                const targetState = hoveredState.summary ? hoveredState.summary.state : hoveredState.displayName
                if (onSelectState) onSelectState(targetState)
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span>Explore State Dossier</span>
              <ArrowRightOutlined style={{ fontSize: 9 }} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: isDark ? '#e2e8f0' : '#334155' }}>
              National Threat Monitor · Hover state for metrics
            </span>
          </div>
        )}
      </div>

      {/* 3. Floating Tactile Navigation Controls (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 12,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <button
          type="button"
          onClick={() => setZoomInTrigger((prev) => prev + 1)}
          title="Zoom In"
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(10px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
            color: isDark ? '#e2e8f0' : '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            fontSize: '12px',
          }}
        >
          <PlusOutlined />
        </button>

        <button
          type="button"
          onClick={() => setZoomOutTrigger((prev) => prev + 1)}
          title="Zoom Out"
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(10px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
            color: isDark ? '#e2e8f0' : '#334155',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            fontSize: '12px',
          }}
        >
          <MinusOutlined />
        </button>

        <button
          type="button"
          onClick={handleResetView}
          title="Reset to 10% Boosted View & Center"
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(10px)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
            color: isDark ? '#38bdf8' : '#2563eb',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            fontSize: '12px',
          }}
        >
          <ReloadOutlined />
        </button>
      </div>

      {/* 4. Interactive Choropleth Legend (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          right: 12,
          background: isDark ? 'rgba(11, 15, 25, 0.92)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(14px)',
          padding: '8px 12px',
          borderRadius: 10,
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
          zIndex: 1000,
          fontSize: '11px',
          color: isDark ? '#cbd5e1' : '#334155',
          boxShadow: isDark
            ? '0 10px 30px rgba(0, 0, 0, 0.5)'
            : '0 4px 16px rgba(0, 0, 0, 0.08)',
          minWidth: 165,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <div style={{ fontWeight: 700, color: isDark ? '#f8fafc' : '#0f172a', fontSize: '11px' }}>
            {metricMode === 'risk'
              ? 'Risk Severity'
              : metricMode === 'anomalies'
              ? 'Active Anomalies'
              : metricMode === 'expenditure'
              ? 'Outlay (₹ Cr)'
              : 'Works Count'}
          </div>
          {filterTier && (
            <button
              type="button"
              onClick={() => setFilterTier(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Reset
            </button>
          )}
        </div>

        {metricMode === 'risk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div
              onClick={() => setFilterTier((curr) => (curr === 'critical' ? null : 'critical'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                background: filterTier === 'critical' ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2') : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#ef4444', display: 'inline-block' }} />
                <span>Critical (&ge; 75)</span>
              </div>
              <strong style={{ fontSize: '10px', color: '#ef4444' }}>{nationalStats.criticalCount}</strong>
            </div>

            <div
              onClick={() => setFilterTier((curr) => (curr === 'high' ? null : 'high'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                background: filterTier === 'high' ? (isDark ? 'rgba(249, 115, 22, 0.25)' : '#ffedd5') : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#f97316', display: 'inline-block' }} />
                <span>High (50 - 74)</span>
              </div>
              <strong style={{ fontSize: '10px', color: '#f97316' }}>{nationalStats.highCount}</strong>
            </div>

            <div
              onClick={() => setFilterTier((curr) => (curr === 'medium' ? null : 'medium'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                background: filterTier === 'medium' ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#fef3c7') : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#f59e0b', display: 'inline-block' }} />
                <span>Medium (25 - 49)</span>
              </div>
              <strong style={{ fontSize: '10px', color: '#f59e0b' }}>{nationalStats.medCount}</strong>
            </div>

            <div
              onClick={() => setFilterTier((curr) => (curr === 'low' ? null : 'low'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                background: filterTier === 'low' ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#dcfce7') : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#10b981', display: 'inline-block' }} />
                <span>Low (&lt; 25)</span>
              </div>
              <strong style={{ fontSize: '10px', color: '#10b981' }}>{nationalStats.lowCount}</strong>
            </div>

            <div
              onClick={() => setFilterTier((curr) => (curr === 'nodata' ? null : 'nodata'))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 4,
                background: filterTier === 'nodata' ? (isDark ? 'rgba(148, 163, 184, 0.25)' : '#f1f5f9') : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#cbd5e1', display: 'inline-block', border: '1px solid #94a3b8' }} />
                <span style={{ color: isDark ? '#94a3b8' : '#64748b' }}>No Data</span>
              </div>
            </div>
          </div>
        )}

        {metricMode === 'anomalies' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#e11d48' }} />
              <span>&ge; 25 Critical</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#9333ea' }} />
              <span>15 - 24 Elevated</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#a855f7' }} />
              <span>8 - 14 Moderate</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#0284c7' }} />
              <span>1 - 7 Low</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#10b981' }} />
              <span>0 Clean</span>
            </div>
          </div>
        )}

        {metricMode === 'expenditure' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#064e3b' }} />
              <span>&ge; ₹350 Cr</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#047857' }} />
              <span>₹200 - ₹349 Cr</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#10b981' }} />
              <span>₹100 - ₹199 Cr</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#34d399' }} />
              <span>₹40 - ₹99 Cr</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#a7f3d0' }} />
              <span>&lt; ₹40 Cr</span>
            </div>
          </div>
        )}

        {metricMode === 'works' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#1e3a8a' }} />
              <span>&ge; 3,000 Works</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#1d4ed8' }} />
              <span>1,500 - 2,999</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#2563eb' }} />
              <span>800 - 1,499</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#60a5fa' }} />
              <span>300 - 799</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2.5, background: '#bfdbfe' }} />
              <span>&lt; 300 Works</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Leaflet Map Container */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomSnap={0.05}
        zoomDelta={0.25}
        minZoom={3.8}
        maxZoom={8.5}
        style={{
          height: '100%',
          width: '100%',
          background: isDark
            ? '#0b0f19'
            : basemapTheme === 'canvas'
            ? 'radial-gradient(circle at 50% 45%, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%)'
            : '#f1f5f9',
        }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
      >
        <MapCameraController
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          targetCoords={targetCoords}
          resetTrigger={resetTrigger}
          zoomInTrigger={zoomInTrigger}
          zoomOutTrigger={zoomOutTrigger}
        />

        {/* Crisp Esri Basemap Tiles (No API key, zero watermarks) */}
        {basemapTheme === 'carto' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            opacity={0.65}
          />
        )}
        {basemapTheme === 'dark' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            opacity={0.85}
          />
        )}

        {/* Primary GeoJSON Choropleth Vector Layer */}
        <GeoJSON
          key={geoJsonKey}
          data={geoData}
          style={styleFeature}
          onEachFeature={onEachFeature}
          className={isDark ? 'prahar-map-vector-layer-dark' : 'prahar-map-vector-layer'}
        />

        {/* Radar Hotspot Beacons on Epicenters */}
        {showRadarHotspots &&
          hotspotBeacons.map((beacon) => (
            <Marker
              key={`beacon-${beacon.state}`}
              position={beacon.coords}
              icon={createPulseBeaconIcon(beacon.tier, beacon.anomalies)}
              eventHandlers={{
                click: () => handleStateSelect(beacon.state),
                mouseover: () => {
                  const summary = stateDataMap.get(beacon.state.toLowerCase())
                  setHoveredState({ summary, displayName: beacon.state })
                },
              }}
            />
          ))}
      </MapContainer>
    </div>
  )
}

export default IndiaMap
