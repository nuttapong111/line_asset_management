import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/axios'
import { baht, bahtExact, thaiDate, thaiMonth } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface Dashboard {
  summary: {
    total: number
    collected: number
    pending: number
    overdue: number
    occupancyRate: number
    totalUnits: number
    occupiedUnits: number
    propertyCount: number
    pendingSlips: number
    contractsExpiring30: number
    contractsExpiring60: number
    unackedMaintenance: number
    renewalRequests: number
  }
  recentSlips: {
    id: string
    amount: number
    roomNumber: string
    propertyName: string
    tenantName: string
    slipUploadedAt?: string
  }[]
  expiringContracts: {
    id: string
    roomNumber: string
    propertyName: string
    tenantName: string
    endDate: string
  }[]
  overdueInvoices?: {
    id: string
    roomNumber: string
    propertyName: string
    tenantName: string
    total: number
    dueDate: string
  }[]
  newTickets?: {
    id: string
    ticketNo: string
    title: string
    roomNumber: string
    propertyName: string
    createdAt?: string
  }[]
  tasks?: { kind: string; id: string; title: string; meta: string; href: string }[]
}

interface MonthPoint {
  month: number
  year: number
  revenue: number
  pending: number
  overdue: number
}

const DOT: Record<string, string> = {
  slip: 'bg-warn-fg',
  ticket: 'bg-danger',
  meter: 'bg-info',
  contract: 'bg-info',
}

function daysLate(due: string) {
  const ms = Date.now() - new Date(due).getTime()
  return `${Math.max(0, Math.floor(ms / 86400000))} วัน`
}

function ageLabel(iso?: string) {
  if (!iso) return ''
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (hours < 1) return 'เก่าสุดไม่ถึง 1 ชม.'
  if (hours < 48) return `เก่าสุด ${hours} ชม.`
  return `เก่าสุด ${Math.floor(hours / 24)} วัน`
}

function compact(n: number) {
  if (n >= 1000) return `฿${Math.round(n / 1000)}k`
  return baht(n)
}

export default function PortalDashboard() {
  const role = useAuthStore((s) => s.role)
  const user = useAuthStore((s) => s.user)
  const [data, setData] = useState<Dashboard>()
  const [months, setMonths] = useState<MonthPoint[]>([])
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()
  const [reminding, setReminding] = useState<string>()
  const [subBanner, setSubBanner] = useState<{
    status: string
    daysLeft: number | null
    expiresAt?: string
    permanent?: boolean
  }>()

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))

    const now = new Date()
    const year = now.getFullYear()
    const keys: { year: number; month: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, now.getMonth() - i, 1)
      keys.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }
    const years = Array.from(new Set(keys.map((k) => k.year)))
    Promise.all(years.map((y) => api.get(`/reports/revenue?year=${y}`).then((r) => r.data.byMonth as MonthPoint[])))
      .then((groups) => {
        const all = groups.flat()
        setMonths(keys.map((k) => all.find((m) => m.year === k.year && m.month === k.month) || { ...k, revenue: 0, pending: 0, overdue: 0 }))
      })
      .catch(() => setMonths(keys.map((k) => ({ ...k, revenue: 0, pending: 0, overdue: 0 }))))

    if (role === 'OWNER') {
      api
        .get('/subscriptions/me')
        .then((r) =>
          setSubBanner({
            status: r.data.owner.subscriptionStatus,
            daysLeft: r.data.owner.daysLeft,
            expiresAt: r.data.owner.expiresAt,
            permanent: Boolean(r.data.owner.permanent || r.data.owner.plan === 'PERMANENT'),
          })
        )
        .catch(() => {})
    }
  }, [role])

  async function remind(id: string) {
    setReminding(id)
    setNote(undefined)
    try {
      const { data: res } = await api.post('/invoices/remind', { invoiceIds: [id] })
      setNote(`ส่งเตือนแล้ว ${res.sent} รายการ`)
    } catch (e: any) {
      setNote(e.response?.data?.error || 'ส่งเตือนไม่สำเร็จ')
    } finally {
      setReminding(undefined)
    }
  }

  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-muted">กำลังโหลด...</p>

  const s = data.summary
  const current = months[months.length - 1]
  const billed = current ? current.revenue + current.pending + current.overdue : 0
  const pct = billed ? Math.round((current.revenue / billed) * 100) : 0
  const slipSum = data.recentSlips.reduce((a, p) => a + Number(p.amount || 0), 0)
  const oldestSlip = [...data.recentSlips].sort((a, b) => {
    const ta = a.slipUploadedAt ? new Date(a.slipUploadedAt).getTime() : Date.now()
    const tb = b.slipUploadedAt ? new Date(b.slipUploadedAt).getTime() : Date.now()
    return ta - tb
  })[0]
  const vacant = Math.max(0, s.totalUnits - s.occupiedUnits)
  const overdueRows = data.overdueInvoices || []
  const maxBar = Math.max(1, ...months.map((m) => m.revenue + m.pending + m.overdue))

  const tasks =
    data.tasks && data.tasks.length
      ? data.tasks.slice(0, 6)
      : [
          ...data.recentSlips.slice(0, 3).map((p) => ({
            kind: 'slip',
            id: p.id,
            title: `ตรวจสลิป ห้อง ${p.roomNumber}`,
            meta: p.tenantName,
            href: '/portal/billing',
          })),
          ...(data.newTickets || []).slice(0, 2).map((t) => ({
            kind: 'ticket',
            id: t.id,
            title: `แจ้งซ่อม ${t.ticketNo}`,
            meta: `${t.roomNumber} · ${t.title}`,
            href: `/admin/maintenance/${t.id}`,
          })),
          ...data.expiringContracts.slice(0, 2).map((c) => ({
            kind: 'contract',
            id: c.id,
            title: `สัญญาใกล้หมด ห้อง ${c.roomNumber}`,
            meta: c.tenantName,
            href: `/admin/contract/${c.id}`,
          })),
        ]

  const today = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const showSubWarn =
    subBanner &&
    !subBanner.permanent &&
    (subBanner.status === 'GRACE' ||
      subBanner.status === 'SUSPENDED' ||
      (subBanner.daysLeft !== null && subBanner.daysLeft <= 7))

  const tiles = [
    {
      label: current ? 'รับแล้วเดือนนี้' : 'รับแล้ว',
      value: baht(current ? current.revenue : s.collected),
      sub: current && billed ? `${pct}% ของยอดที่ออกบิล ${baht(billed)}` : `${s.propertyCount} อาคาร`,
      color: 'text-ink',
    },
    {
      label: 'สลิปรอตรวจ',
      value: slipSum ? baht(slipSum) : String(s.pendingSlips),
      sub: `${s.pendingSlips} รายการ${oldestSlip ? ` · ${ageLabel(oldestSlip.slipUploadedAt)}` : ''}`,
      color: 'text-warn-fg',
    },
    {
      label: 'ค้างชำระ',
      value: baht(s.overdue),
      sub: overdueRows.length ? `${overdueRows.length} รายการในตาราง` : 'ไม่มีบิลเลยกำหนด',
      color: 'text-danger',
    },
    {
      label: 'อัตราเข้าพัก',
      value: `${s.occupancyRate}%`,
      sub: `${s.occupiedUnits} / ${s.totalUnits} ห้อง · ว่าง ${vacant}`,
      color: 'text-ink',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-display text-[28px] font-bold">ภาพรวม</h1>
          <span className="text-sm text-muted">
            สวัสดี{user?.name ? ` ${user.name}` : ''} · {today}
          </span>
        </div>
      </header>

      {showSubWarn && subBanner && (
        <Link to="/portal/subscription" className="block rounded-[18px] bg-warn-bg text-warn-fg px-5 py-4 text-sm">
          <div className="font-semibold text-[17px]">
            {subBanner.status === 'SUSPENDED'
              ? 'บัญชีถูกระงับ'
              : subBanner.status === 'GRACE'
                ? 'เลยกำหนดค่าบริการแล้ว (อยู่ในระยะผ่อนผัน)'
                : `ทดลองใช้เหลือ ${subBanner.daysLeft} วัน`}
          </div>
          <div className="text-sm mt-0.5">หมดอายุ {thaiDate(subBanner.expiresAt)}</div>
        </Link>
      )}

      <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {tiles.map((c) => (
          <div key={c.label} className="bg-white rounded-[18px] p-5 flex flex-col gap-1.5">
            <span className="text-sm text-muted">{c.label}</span>
            <strong className={`font-display text-[30px] pf-amount ${c.color}`}>{c.value}</strong>
            <span className="text-[13px] text-muted">{c.sub}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-4">
        <div className="min-w-0 bg-white rounded-[18px] p-[22px] flex flex-col gap-4" style={{ flex: '2 1 480px' }}>
          <div className="flex flex-wrap gap-3 justify-between items-baseline">
            <h2 className="m-0 font-display text-lg font-semibold">รายรับ 6 เดือน</h2>
            <div className="flex gap-3.5 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-primary" />
                รับแล้ว
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-warn-chart" />
                ค้าง / รอตรวจ
              </span>
            </div>
          </div>
          {months.length === 0 ? (
            <p className="text-sm text-muted m-0">กำลังโหลดกราฟ...</p>
          ) : (
            <>
              <div
                role="img"
                aria-label="กราฟรายรับ 6 เดือน"
                className="h-60 flex items-end gap-[4%] px-[2%] border-b border-line-input"
              >
                {months.map((b) => {
                  const due = b.pending + b.overdue
                  const paidH = (b.revenue / maxBar) * 100
                  const dueH = (due / maxBar) * 100
                  return (
                    <div key={`${b.year}-${b.month}`} className="flex-1 h-full flex flex-col justify-end items-stretch gap-0.5">
                      <span className="text-center text-xs font-semibold text-muted mb-1">{compact(b.revenue + due)}</span>
                      <span className="bg-warn-chart rounded-t-md" style={{ height: `${dueH}%` }} />
                      <span className="bg-primary" style={{ height: `${paidH}%`, minHeight: b.revenue ? 2 : 0 }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-[4%] px-[2%]">
                {months.map((b) => (
                  <span key={`l-${b.year}-${b.month}`} className="flex-1 text-center text-[13px] text-muted">
                    {thaiMonth(b.month)}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 bg-white rounded-[18px] p-[22px] flex flex-col gap-3" style={{ flex: '1 1 300px' }}>
          <h2 className="m-0 font-display text-lg font-semibold">งานที่ต้องทำ</h2>
          {tasks.length === 0 && <p className="text-sm text-muted m-0">ไม่มีงานค้าง</p>}
          {tasks.map((t) => (
            <Link
              key={`${t.kind}-${t.id}`}
              to={t.href}
              className="border border-line-soft rounded-[14px] px-3.5 py-3 no-underline text-ink flex items-center gap-3"
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[t.kind] || 'bg-muted'}`} />
              <span className="flex-1 flex flex-col">
                <strong className="text-[15px]">{t.title}</strong>
                <span className="text-[13px] text-muted">{t.meta}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5">
        <div className="flex justify-between items-baseline">
          <h2 className="m-0 font-display text-lg font-semibold">ค้างชำระ</h2>
          <Link to="/portal/billing" className="text-sm font-semibold text-primary">
            ดูบิลทั้งหมด
          </Link>
        </div>
        {note && <p className="m-0 text-sm text-ok-fg">{note}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted text-[13px]">
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">ห้อง</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">ผู้เช่า</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">บิล</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold text-right">ยอด (รวมค่าปรับ)</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">เลยมา</th>
                <th className="px-3 py-2.5 border-b border-line-input" />
              </tr>
            </thead>
            <tbody>
              {overdueRows.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 border-b border-line-soft font-bold">{o.roomNumber}</td>
                  <td className="p-3 border-b border-line-soft">{o.tenantName}</td>
                  <td className="p-3 border-b border-line-soft">{o.propertyName}</td>
                  <td className="p-3 border-b border-line-soft text-right font-bold pf-amount">{bahtExact(o.total)}</td>
                  <td className="p-3 border-b border-line-soft">
                    <span className="px-2.5 py-0.5 rounded-full bg-danger-bg text-danger text-[13px] font-semibold">{daysLate(o.dueDate)}</span>
                  </td>
                  <td className="p-3 border-b border-line-soft text-right">
                    <button
                      type="button"
                      disabled={reminding === o.id}
                      onClick={() => remind(o.id)}
                      className="h-9 px-3.5 border-[1.5px] border-primary rounded-[10px] bg-white text-primary font-sans text-sm font-bold disabled:opacity-50"
                    >
                      ส่งเตือนทาง LINE
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {overdueRows.length === 0 && <p className="text-sm text-muted text-center py-6 m-0">ไม่มีบิลค้างชำระ</p>}
        </div>
      </section>
    </div>
  )
}
