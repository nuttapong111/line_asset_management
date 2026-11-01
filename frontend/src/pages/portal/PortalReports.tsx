import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { baht, thaiMonth } from '../../lib/utils'
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

type Range = '3' | '6' | 'year'

export default function PortalReports() {
  const jwt = useAuthStore((s) => s.jwt)
  const [year, setYear] = useState(new Date().getFullYear())
  const [propertyId, setPropertyId] = useState('')
  const [range, setRange] = useState<Range>('6')
  const [properties, setProperties] = useState<Property[]>([])
  const [report, setReport] = useState<RevenueReport>()
  const [prevMonths, setPrevMonths] = useState<RevenueReport['byMonth']>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    api.get('/properties').then((r) => setProperties(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const q = new URLSearchParams({ year: String(year) })
    if (propertyId) q.set('propertyId', propertyId)
    api
      .get(`/reports/revenue?${q}`)
      .then((r) => setReport(r.data))
      .catch(() => setReport(undefined))

    const now = new Date()
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12
    const need = range === '3' ? 3 : range === '6' ? 6 : 12
    if (range !== 'year' && endMonth < need) {
      const pq = new URLSearchParams({ year: String(year - 1) })
      if (propertyId) pq.set('propertyId', propertyId)
      api
        .get(`/reports/revenue?${pq}`)
        .then((r) => setPrevMonths(r.data.byMonth || []))
        .catch(() => setPrevMonths([]))
    } else {
      setPrevMonths([])
    }
  }, [year, propertyId, range])

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
  const now = new Date()
  const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12
  const need = range === '3' ? 3 : range === '6' ? 6 : 12
  const keys: { year: number; month: number }[] = []
  for (let i = need - 1; i >= 0; i--) {
    const d = new Date(year, endMonth - 1 - i, 1)
    if (range === 'year' && d.getFullYear() !== year) continue
    keys.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
  }
  const pool = [...prevMonths, ...(report?.byMonth || [])]
  const rows = keys
    .map((k) => pool.find((m) => m.year === k.year && m.month === k.month) || { ...k, revenue: 0, pending: 0, overdue: 0 })
    .slice()
    .reverse()

  const collected = rows.reduce((a, m) => a + m.revenue, 0)
  const pending = rows.reduce((a, m) => a + m.pending, 0)
  const overdue = rows.reduce((a, m) => a + m.overdue, 0)
  const billed = collected + pending + overdue
  const rate = billed ? Math.round((collected / billed) * 1000) / 10 : 0
  const propName = properties.find((p) => p.id === propertyId)?.name
  const first = rows[rows.length - 1]
  const last = rows[0]
  const span =
    first && last
      ? `${thaiMonth(first.month)} – ${thaiMonth(last.month)} ${last.year + 543}`
      : `ปี ${year + 543}`

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-display text-[28px] font-bold">รายงานรายรับ</h1>
          <span className="text-sm text-muted">
            {span} · {propName || 'ทุกอาคาร'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-segment">
            {(
              [
                ['3', '3 เดือน'],
                ['6', '6 เดือน'],
                ['year', 'ปีนี้'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={range === k}
                onClick={() => setRange(k)}
                className={`h-9 px-3.5 border-0 rounded-[9px] font-sans text-sm ${range === k ? 'bg-white text-ink font-bold' : 'bg-transparent text-muted font-semibold'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select className="h-11 px-3 rounded-[10px] border border-line-input bg-white font-sans text-sm font-semibold" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                ปี {y + 543}
              </option>
            ))}
          </select>
          <select className="h-11 px-3 rounded-[10px] border border-line-input bg-white font-sans text-sm font-semibold min-w-[140px]" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">ทุกอาคาร</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" disabled={exporting} onClick={() => download('csv')} className="h-11 px-4 rounded-[10px] border-[1.5px] border-line-input bg-white font-sans text-[15px] font-semibold disabled:opacity-50">
            ส่งออก CSV
          </button>
          <button type="button" disabled={exporting} onClick={() => download('xlsx')} className="h-11 px-4 rounded-[10px] border-0 bg-primary text-white font-sans text-[15px] font-bold disabled:opacity-50">
            ส่งออก Excel
          </button>
        </div>
      </header>

      {!report && <p className="text-muted">กำลังโหลด...</p>}
      {report && (
        <>
          <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <Tile label={`รับแล้ว ${rows.length} เดือน`} value={baht(collected)} sub={rows.length ? `เฉลี่ย ${baht(collected / rows.length)} / เดือน` : ''} />
            <Tile label="อัตราเก็บเงินได้" value={`${rate}%`} sub="จากยอดที่ออกบิลในช่วงนี้" />
            <Tile label="ค้างชำระ" value={baht(overdue)} sub={`รอรับ ${baht(pending)}`} />
          </section>

          <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5">
            <h2 className="m-0 font-display text-lg font-semibold">รายเดือน</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="text-right text-muted text-[13px]">
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold text-left">เดือน</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">รับแล้ว</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">รอรับ</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">ค้าง</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold text-left w-[200px]">เก็บได้</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const sum = r.revenue + r.pending + r.overdue
                    const p = sum ? Math.round((r.revenue / sum) * 100) : 0
                    return (
                      <tr key={`${r.year}-${r.month}`} className="text-right">
                        <td className="p-3 border-b border-line-soft text-left font-bold">
                          {thaiMonth(r.month)} {String(r.year + 543).slice(-2)}
                        </td>
                        <td className="p-3 border-b border-line-soft font-bold">{baht(r.revenue)}</td>
                        <td className="p-3 border-b border-line-soft">{baht(r.pending)}</td>
                        <td className={`p-3 border-b border-line-soft ${r.overdue ? 'text-danger' : 'text-muted'}`}>{baht(r.overdue)}</td>
                        <td className="p-3 border-b border-line-soft text-left">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 h-2 rounded-full bg-segment flex">
                              <span className="h-2 rounded-full bg-primary" style={{ width: `${p}%` }} />
                            </span>
                            <span className="w-12 text-[13px]">{p}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5">
            <h2 className="m-0 font-display text-lg font-semibold">แยกตามอาคาร</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted text-[13px]">
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">อาคาร</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">เข้าพัก</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold text-right">รายได้</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProperty.map((p) => (
                    <tr key={p.propertyId}>
                      <td className="p-3 border-b border-line-soft font-bold">{p.name}</td>
                      <td className="p-3 border-b border-line-soft">{p.occupancyRate}%</td>
                      <td className="p-3 border-b border-line-soft text-right font-bold pf-amount">{baht(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.byProperty.length === 0 && <p className="text-sm text-muted text-center py-6 m-0">ไม่มีอาคารในช่วงนี้</p>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-[18px] p-5 flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <strong className="font-display text-[30px] pf-amount">{value}</strong>
      <span className="text-[13px] text-muted">{sub}</span>
    </div>
  )
}
