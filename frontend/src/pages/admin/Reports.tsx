import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Card, Button } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiMonth } from '../../lib/utils'

interface RevenueReport {
  summary: { total: number; collected: number; pending: number; overdue: number }
  byProperty: { propertyId: string; name: string; revenue: number; occupancyRate: number }[]
  byMonth: { month: number; year: number; revenue: number }[]
}

export default function Reports() {
  const [report, setReport] = useState<RevenueReport>()

  useEffect(() => {
    api.get('/reports/revenue').then((r) => setReport(r.data))
  }, [])

  if (!report) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const maxRevenue = Math.max(1, ...report.byMonth.map((m) => m.revenue))

  async function exportCsv() {
    try {
      const res = await api.get('/reports/export?format=csv', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'invoices.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('ส่งออกไม่สำเร็จ')
    }
  }

  return (
    <div className="pb-20">
      <TopBar title="รายงานรายได้" back={false} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center py-3"><div className="font-bold text-line text-sm">{baht(report.summary.collected)}</div><div className="text-[10px] text-gray-400">รับแล้ว</div></Card>
          <Card className="text-center py-3"><div className="font-bold text-amber text-sm">{baht(report.summary.pending)}</div><div className="text-[10px] text-gray-400">รอรับ</div></Card>
          <Card className="text-center py-3"><div className="font-bold text-danger text-sm">{baht(report.summary.overdue)}</div><div className="text-[10px] text-gray-400">ค้างชำระ</div></Card>
        </div>

        <Card>
          <h4 className="font-semibold mb-3">รายได้ย้อนหลัง 6 เดือน</h4>
          <div className="flex items-end justify-between gap-2 h-40">
            {report.byMonth.map((m) => (
              <div key={`${m.year}-${m.month}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-line rounded-t-md" style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: '4px' }} />
                <span className="text-[10px] text-gray-400">{thaiMonth(m.month)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h4 className="font-semibold mb-2">แยกตามอสังหาฯ</h4>
          <div className="space-y-2">
            {report.byProperty.map((p) => (
              <div key={p.propertyId} className="flex justify-between items-center text-sm">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">อัตราเช่า {p.occupancyRate}%</div>
                </div>
                <span className="font-semibold text-line">{baht(p.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Button variant="secondary" onClick={exportCsv}>ส่งออก CSV</Button>
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
