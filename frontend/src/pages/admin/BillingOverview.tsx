import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { bahtExact, cls, thaiMonth } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface Invoice {
  id: string
  month: number
  year: number
  total: string
  status: string
  type?: string
  unit: { roomNumber: string; propertyId: string }
  payment?: { id: string; status: string } | null
}

const TYPE_TH: Record<string, string> = { RENT: 'ค่าเช่า', UTILITY: 'ค่าน้ำไฟ', SHORTFALL: 'ส่วนต่าง' }

const STATUS: Record<string, { text: string; cls: string }> = {
  PAID: { text: 'ชำระแล้ว', cls: 'bg-ok-bg text-ok-fg' },
  PENDING: { text: 'รอชำระ', cls: 'bg-info-bg text-info' },
  SLIP_UPLOADED: { text: 'รอตรวจ', cls: 'bg-warn-bg text-warn-fg' },
  OVERDUE: { text: 'เลยกำหนด', cls: 'bg-danger-bg text-danger' },
}

export default function BillingOverview() {
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const navRole = role === 'OWNER' ? 'OWNER' : 'ADMIN'
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [properties, setProperties] = useState<{ id: string }[]>([])
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data)).catch(() => {})
    api.get('/properties').then((r) => setProperties(r.data)).catch(() => {})
  }, [])

  const monthRows = invoices.filter((i) => i.status !== 'CANCELLED' && i.month === month && i.year === year)
  const counts = {
    all: monthRows.length,
    PENDING: monthRows.filter((i) => i.status === 'PENDING').length,
    SLIP_UPLOADED: monthRows.filter((i) => i.status === 'SLIP_UPLOADED').length,
    OVERDUE: monthRows.filter((i) => i.status === 'OVERDUE').length,
    PAID: monthRows.filter((i) => i.status === 'PAID').length,
  }
  const chips = [
    { key: 'all', label: `ทั้งหมด ${counts.all}` },
    { key: 'PENDING', label: `รอชำระ ${counts.PENDING}` },
    { key: 'SLIP_UPLOADED', label: `รอตรวจ ${counts.SLIP_UPLOADED}` },
    { key: 'OVERDUE', label: `เลยกำหนด ${counts.OVERDUE}` },
    { key: 'PAID', label: `ชำระแล้ว ${counts.PAID}` },
  ]
  const rows = useMemo(
    () => monthRows.filter((i) => (filter === 'all' ? true : i.status === filter)),
    // monthRows is derived each render; filter is the user control
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, month, year, filter]
  )

  function openInvoice(inv: Invoice) {
    if (inv.payment && (inv.status === 'SLIP_UPLOADED' || inv.payment.status === 'UNDER_REVIEW')) {
      nav(`/admin/slip/${inv.payment.id}`)
    } else if (inv.status === 'PAID' && inv.payment) {
      nav(`/admin/receipt/${inv.payment.id}`)
    } else {
      nav(`/admin/invoice/${inv.id}`)
    }
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())
  }

  const meterHref = properties[0] ? `/admin/property/${properties[0].id}/meter` : '/admin/portfolio'

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h1 className="m-0 font-display text-[26px] font-bold">บิล</h1>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="เดือนก่อน" className="w-9 h-10 text-ink" onClick={() => shiftMonth(-1)}>‹</button>
            <span className="h-10 px-1 text-sm font-bold flex items-center">
              {thaiMonth(month)} {year + 543}
            </span>
            <button type="button" aria-label="เดือนถัดไป" className="w-9 h-10 text-ink" onClick={() => shiftMonth(1)}>›</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="h-12 rounded-button border-[1.5px] border-primary bg-white text-primary text-sm font-bold flex items-center justify-center gap-1.5" onClick={() => nav(meterHref)}>
            จดมิเตอร์
          </button>
          <button type="button" className="h-12 rounded-button bg-primary text-white text-sm font-bold flex items-center justify-center gap-1.5" onClick={() => nav('/admin/invoice-builder')}>
            สร้าง/ส่งบิล
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {chips.map((c) => {
            const on = filter === c.key
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                className={cls(
                  'h-[34px] px-3 rounded-full border-[1.5px] text-[13px] font-semibold whitespace-nowrap',
                  on ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-line-soft'
                )}
                onClick={() => setFilter(c.key)}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <div className="bg-white rounded-card overflow-hidden">
          {rows.length === 0 && <p className="px-3.5 py-6 text-sm text-muted text-center">ยังไม่มีบิลเดือนนี้</p>}
          {rows.map((inv) => {
            const st = STATUS[inv.status] || STATUS.PENDING
            return (
              <button
                key={inv.id}
                type="button"
                className="w-full px-3.5 py-2.5 border-b border-line-soft text-left flex items-center gap-3"
                onClick={() => openInvoice(inv)}
              >
                <span className="w-[52px] font-display text-[15px] font-bold">{inv.unit.roomNumber}</span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm font-semibold">{bahtExact(inv.total)}</span>
                  <span className="text-xs text-muted">{TYPE_TH[inv.type || 'RENT'] || 'บิล'} {thaiMonth(inv.month)}</span>
                </span>
                <span className={cls('px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap', st.cls)}>{st.text}</span>
              </button>
            )
          })}
        </div>
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
