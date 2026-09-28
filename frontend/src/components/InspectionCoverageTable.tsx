import React, { useEffect, useState } from 'react'
import { Table, Tag, Typography, Spin, Card } from 'antd'
import { complianceApi } from '../api/compliance'

const { Text } = Typography

export const InspectionCoverageTable: React.FC<{ state?: string; constituencies?: any[] }> = ({ state, constituencies = [] }) => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [state, constituencies])

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await complianceApi.getInspections({ per_page: 100 })
      
      // Calculate district-level risk and util from constituencies
      const distStats: Record<string, { totalRisk: number; count: number; totalUtil: number; utilCount: number }> = {}
      constituencies.forEach(c => {
        const d = c.district || 'Unknown'
        if (!distStats[d]) distStats[d] = { totalRisk: 0, count: 0, totalUtil: 0, utilCount: 0 }
        distStats[d].totalRisk += (c.risk_score || 0)
        distStats[d].count += 1
        if (c.fund_utilization_rate !== null && c.fund_utilization_rate !== undefined) {
          distStats[d].totalUtil += c.fund_utilization_rate
          distStats[d].utilCount += 1
        }
      })

      // Merge
      const merged = res.data.map((row: any) => {
        const stats = distStats[row.district]
        return {
          ...row,
          avgRisk: stats && stats.count > 0 ? Math.round(stats.totalRisk / stats.count) : null,
          avgUtil: stats && stats.utilCount > 0 ? (stats.totalUtil / stats.utilCount).toFixed(1) : null,
        }
      })
      setData(merged)
    } catch (err) {
      console.error('Failed to load inspection coverage', err)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'District',
      dataIndex: 'district',
      key: 'district',
      render: (val: string) => <Text strong>{val}</Text>,
    },
    {
      title: 'Avg Risk',
      dataIndex: 'avgRisk',
      key: 'avgRisk',
      render: (val: number | null) => val !== null ? <Tag color={val >= 50 ? 'error' : val >= 25 ? 'warning' : 'success'}>{val}</Tag> : 'N/A',
      sorter: (a: any, b: any) => (b.avgRisk || 0) - (a.avgRisk || 0),
    },
    {
      title: 'Avg Utilization',
      dataIndex: 'avgUtil',
      key: 'avgUtil',
      render: (val: string | null) => val !== null ? <Text>{val}%</Text> : 'N/A',
      sorter: (a: any, b: any) => parseFloat(b.avgUtil || '0') - parseFloat(a.avgUtil || '0'),
    },
    {
      title: 'Active Works',
      dataIndex: 'works_in_progress',
      key: 'works_in_progress',
    },
    {
      title: 'Inspected',
      dataIndex: 'works_inspected',
      key: 'works_inspected',
    },
    {
      title: 'Coverage %',
      dataIndex: 'coverage_pct',
      key: 'coverage_pct',
      render: (val: number) => {
        let color = '#059669' // green
        if (val < 10) color = '#dc2626' // red
        return <Text strong style={{ color }}>{val}%</Text>
      },
      sorter: (a: any, b: any) => (a.coverage_pct || 0) - (b.coverage_pct || 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        if (val === 'COMPLIANT') return <Tag color="success">Compliant</Tag>
        return <Tag color="error">Quota Violation</Tag>
      },
    },
  ]

  return (
    <Card title="District Comparison (Risk, Utilization & Inspection Quota)" bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, border: '1px solid var(--border-primary)', boxShadow: 'var(--shadow-sm)' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey={(r: any) => r.id}
          pagination={{ pageSize: 5 }}
        />
      )}
    </Card>
  )
}
