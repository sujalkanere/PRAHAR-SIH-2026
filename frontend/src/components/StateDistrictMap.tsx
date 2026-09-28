import React from 'react'
import { Card, Row, Col, Typography, Tooltip } from 'antd'

const { Text } = Typography

interface DistrictMapProps {
  state: string
  constituencies: any[]
}

export const StateDistrictMap: React.FC<DistrictMapProps> = ({ state, constituencies }) => {
  // Group constituencies by district to calculate district-level risk
  const districtMap: Record<string, { totalRisk: number; count: number; mp_names: string[] }> = {}
  
  constituencies.forEach((c) => {
    const dName = c.district || 'Unknown District'
    if (!districtMap[dName]) {
      districtMap[dName] = { totalRisk: 0, count: 0, mp_names: [] }
    }
    districtMap[dName].totalRisk += (c.risk_score || 0)
    districtMap[dName].count += 1
    if (c.mp_name) districtMap[dName].mp_names.push(c.mp_name)
  })

  const districts = Object.keys(districtMap).map((d) => {
    const avgRisk = districtMap[d].totalRisk / districtMap[d].count
    let color = '#10b981' // low
    if (avgRisk >= 75) color = '#ef4444' // critical
    else if (avgRisk >= 50) color = '#f97316' // high
    else if (avgRisk >= 25) color = '#f59e0b' // medium

    return {
      name: d,
      avgRisk: Math.round(avgRisk),
      color,
      mps: districtMap[d].mp_names.join(', '),
    }
  }).sort((a, b) => b.avgRisk - a.avgRisk)

  return (
    <Card 
      title={`District Heatmap • ${state}`} 
      style={{ borderRadius: 18, border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}
    >
      {districts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          No district data available for this state.
        </div>
      ) : (
        <Row gutter={[12, 12]}>
          {districts.map((d) => (
            <Col xs={12} sm={8} md={6} lg={4} key={d.name}>
              <Tooltip title={`Avg Risk: ${d.avgRisk} | MPs: ${d.mps || 'None'}`}>
                <div
                  style={{
                    backgroundColor: d.color,
                    color: '#fff',
                    padding: '16px 8px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                    minHeight: 80,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 600, fontSize: '12px', lineHeight: 1.2 }}>
                    {d.name}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '10px', marginTop: 4 }}>
                    Risk: {d.avgRisk}
                  </Text>
                </div>
              </Tooltip>
            </Col>
          ))}
        </Row>
      )}
    </Card>
  )
}
