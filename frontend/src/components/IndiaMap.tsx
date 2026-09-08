import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { StateSummaryItem } from '../types'

interface IndiaMapProps {
  stateSummaries: StateSummaryItem[]
  onSelectState?: (stateName: string) => void
  selectedState?: string | null
}

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

export const getRiskColor = (avgRisk: number, totalWorks: number = 0): string => {
  if (totalWorks === 0 && avgRisk === 0) return '#e2e8f0' // No data — gray
  if (avgRisk >= 75) return '#ef4444'  // Critical (Red)
  if (avgRisk >= 50) return '#f97316'  // High (Orange)
  if (avgRisk >= 25) return '#f59e0b'  // Medium (Amber)
  return '#22c55e'                      // Low (Green)
}

export const IndiaMap: React.FC<IndiaMapProps> = ({
  stateSummaries,
  onSelectState,
  selectedState,
}) => {
  const [geoData, setGeoData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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

  // A stable key derived from the data forces Leaflet GeoJSON to fully re-mount
  // when stateSummaries changes — fixing the stale closure / re-color bug.
  const geoJsonKey = useMemo(
    () => stateSummaries.map((s) => `${s.state}:${s.avg_risk}`).join('|'),
    [stateSummaries]
  )

  const getSummaryForFeature = (rawName: string): { summary?: StateSummaryItem; displayName: string } => {
    const normName = normalizeStateName(rawName)
    let summary = stateDataMap.get(normName.toLowerCase()) || stateDataMap.get(rawName.toLowerCase())
    let displayName = normName
    if (!summary && normName.toLowerCase() === 'andhra pradesh' && stateDataMap.has('telangana')) {
      summary = stateDataMap.get('telangana')
      displayName = 'Telangana & Andhra Pradesh'
    }
    return { summary, displayName }
  }

  const styleFeature = (feature: any) => {
    const rawName = feature.properties?.NAME_1 || feature.properties?.name || ''
    const { summary, displayName } = getSummaryForFeature(rawName)

    const isSelected = selectedState && (
      displayName.toLowerCase().includes(selectedState.toLowerCase()) ||
      selectedState.toLowerCase().includes(displayName.toLowerCase())
    )
    const risk = summary ? summary.avg_risk : 0
    const works = summary ? summary.works : 0
    const fillColor = getRiskColor(risk, works)

    return {
      fillColor: fillColor,
      weight: isSelected ? 3 : 1.2,
      opacity: 1,
      color: isSelected ? '#1d4ed8' : '#94a3b8',
      fillOpacity: isSelected ? 0.95 : (works > 0 ? 0.85 : 0.5),
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const rawName = feature.properties?.NAME_1 || feature.properties?.name || 'Unknown'
    const { summary, displayName } = getSummaryForFeature(rawName)

    const risk = summary ? summary.avg_risk : 0
    const works = summary ? summary.works : 0
    const anomalies = summary ? summary.anomalies : 0
    const highRisk = summary ? summary.high_risk : 0
    const expenditure = summary ? summary.expenditure_cr : 0

    const tier = risk >= 75 ? 'CRITICAL' : risk >= 50 ? 'HIGH' : risk >= 25 ? 'MEDIUM' : works > 0 ? 'LOW' : 'NO DATA'

    layer.bindTooltip(
      `<div style="font-family: Inter, sans-serif; font-size: 13px; min-width: 170px; color: #0f172a;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 14px; color: #0f172a;">${displayName}</strong>
          <span style="font-size: 11px; font-weight: 700; color: #ffffff; background: ${getRiskColor(risk, works)}; padding: 1px 6px; border-radius: 4px;">${tier}</span>
        </div>
        <div style="color: #475569; font-size: 12px; line-height: 1.6;">
          <div>Avg Risk Score: <strong style="color: ${getRiskColor(risk, works)}">${risk}</strong> / 100</div>
          <div>Total Works: <strong style="color: #0f172a;">${works}</strong></div>
          <div>Expenditure: <strong style="color: #15803d;">₹${expenditure.toFixed(2)} Cr</strong></div>
          <div>Active Anomalies: <strong style="color: ${anomalies > 0 ? '#b91c1c' : '#64748b'};">${anomalies}</strong></div>
          <div>High Risk Constituencies: <strong style="color: ${highRisk > 0 ? '#c2410c' : '#64748b'};">${highRisk}</strong></div>
        </div>
      </div>`,
      { className: 'leaflet-tooltip-custom', sticky: true }
    )

    layer.on({
      mouseover: (e: any) => {
        const l = e.target
        l.setStyle({
          weight: 2.5,
          color: '#1d4ed8',
          fillOpacity: 0.95,
        })
      },
      mouseout: (e: any) => {
        const l = e.target
        l.setStyle(styleFeature(feature))
      },
      click: () => {
        if (onSelectState) {
          const targetState = summary ? summary.state : displayName
          onSelectState(targetState)
        }
      },
    })
  }

  if (loading || !geoData) {
    return (
      <div
        style={{
          height: '520px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          borderRadius: 12,
          color: '#64748b',
          border: '1px solid #e2e8f0',
        }}
      >
        Loading National Map...
      </div>
    )
  }

  return (
    <div style={{ height: '520px', width: '100%', position: 'relative' }}>
      <MapContainer
        center={[22.5937, 78.9629]}
        zoom={4.3}
        style={{ height: '100%', width: '100%', background: '#f1f5f9', borderRadius: 12 }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={false}
      >
        <GeoJSON key={geoJsonKey} data={geoData} style={styleFeature} onEachFeature={onEachFeature} />
      </MapContainer>

      {/* Map Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          zIndex: 1000,
          fontSize: '11px',
          color: '#334155',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>State Risk Level</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444' }} />
            <span>Critical (&ge; 75)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f97316' }} />
            <span>High (50 - 74)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b' }} />
            <span>Medium (25 - 49)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22c55e' }} />
            <span>Low (&lt; 25)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e2e8f0', border: '1px solid #cbd5e1' }} />
            <span>No Data Tracked</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndiaMap
