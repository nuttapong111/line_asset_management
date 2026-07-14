import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { baht, thaiMonth } from '../../lib/utils'
import { Button } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'

interface RevenueReport {
  summary: { total: number; collected: number; pending: number; overdue: number }
  byProperty: { propertyId: string; name: string; revenue: number; occupancyRate: number }[]
  byMonth: { month: number; year: number; revenue: number; pending: number; overdue: number }[]
  year: number
}

interface Property {
  id: string
  name: string
}

export default function PortalReports() {
  const jwt = useAuthStore((s) => s.jwt)
  const [year, setYear] = useState(new Date().getFullYear())
  const [propertyId, setPropertyId] = useState('')
  const [properties, setProperties] = useState<Property[]>([])
  const [report, setReport] = useState<RevenueReport>()
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    api.get('/properties').then((r) => setProperties(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const q = new URLSearchParams({ year: String(year) })
    if (propertyId) q.set('propertyId', propertyId)
    api.get(`/reports/revenue?${q}`).then((r) => setReport(r.data)).catch(() => setReport(undefined))
  }, [year, propertyId])

  async function download(format: 'csv' | 'xlsx') {
    if (!jwt) return
    setExporting(true)
    try {
      const q = new URLSearchParams({ format, year: String(year) })
      if (propertyId) q.set('propertyId', propertyId)
      const res = await api.get(`/reports/export?${q}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'xlsx' ? 'invoices.xlsx' : 'invoices.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const maxRevenue = Math.max(1, ...(report?.byMonth.map((m) => m.revenue) || [1]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">รายงานรายได้</h1>
          <p className="text-sm text-gray-500 mt-1">กรองตามปี / ทรัพย์สิน และส่งออกไฟล์</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                ปี {y}
              </option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">ทุกทรัพย์สิน</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" className="!w-auto px-4" onClick={() => download('csv')} disabled={exporting}>
            CSV
          </Button>
          <Button variant="secondary" className="!w-auto px-4" onClick={() => download('xlsx')} disabled={exporting}>
            Excel
          </Button>
        </div>
      </div>

      {!report && <p className="text-gray-400">กำลังโหลด...</p>}
      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="รวมทั้งปี" value={baht(report.summary.total)} />
            <Stat label="รับแล้ว" value={baht(report.summary.collected)} tone="text-line" />
            <Stat label="รอรับ" value={baht(report.summary.pending)} tone="text-amber-600" />
            <Stat label="ค้างชำระ" value={baht(report.summary.overdue)} tone="text-danger" />
          </div>

          <section className="bg-white rounded-xl border border-gray-100 p-4">
            <h2 className="font-semibold mb-4">รายได้รายเดือน ({year})</h2>
            <div className="flex items-end justify-between gap-1 h-44 overflow-x-auto">
              {report.byMonth.map((m) => (
                <div key={m.month} className="flex-1 min-w-[28px] flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-line rounded-t-md"
                    style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: m.revenue ? '4px' : '0' }}
                    title={baht(m.revenue)}
                  />
                  <span className="text-[10px] text-gray-400">{thaiMonth(m.month)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto">
            <h2 className="font-semibold mb-3">แยกตามทรัพย์สิน</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-2 font-medium">ชื่อ</th>
                  <th className="py-2 font-medium">อัตราเช่า</th>
                  <th className="py-2 font-medium text-right">รายได้</th>
                </tr>
              </thead>
              <tbody>
                {report.byProperty.map((p) => (
                  <tr key={p.propertyId} className="border-b border-gray-50">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.occupancyRate}%</td>
                    <td className="py-2 text-right font-semibold text-line">{baht(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className={`text-lg font-bold ${tone || ''}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}
