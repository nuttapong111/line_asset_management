import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { baht, cls, thaiMonth } from '../../lib/utils'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuthStore } from '../../store/authStore'

interface PropertyStats {
  id: string
  name: string
  promptpayNumber?: string
  stats: { total: number; occupied: number; tenants: number; overdue: number; monthlyRevenue: number }
}

interface Task {
  kind: string
  id: string
  title: string
  meta: string
  href: string
}

interface Queue {
  summary: {
    total: number
    collected: number
    pending: number
    overdue: number
    totalUnits: number
    occupiedUnits: number
    pendingSlips: number
  }
  tasks?: Task[]
  newTickets: { id: string; propertyName: string }[]
}

interface InvoiceRow {
  month: number
  year: number
  total: string
  status: string
  unit: { propertyId: string; roomNumber: string }
}

interface UnitRow {
  id: string
  roomNumber: string
  floor?: number | null
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
  invoices: { status: string }[]
}

interface OwnerRow {
  id: string
  name: string
  username?: string
  plan?: string
  subscriptionStatus?: string
  expiresAt?: string | null
  properties: { id: string }[]
}

interface SubPay {
  id: string
  amount: number
  status: string
  slipUploadedAt?: string
  approvedAt?: string
  createdAt: string
}

interface SubMe {
  owner: { subscriptionStatus: string; daysLeft: number | null; plan?: string }
  bill: { amount: number; periodDays: number } | null
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

const ROOM: Record<string, string> = {
  paid: 'bg-ok-bg text-ok-fg',
  review: 'bg-warn-bg text-warn-fg',
  overdue: 'bg-danger text-white',
  vacant: 'bg-surface-2 text-neutral-fg border border-dashed border-placeholder',
  pending: 'bg-info-bg text-info',
  maint: 'bg-warn-bg text-warn-fg',
}

export default function Portfolio() {
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const isOwner = role === 'OWNER'
  const [props, setProps] = useState<PropertyStats[]>([])
  const [queue, setQueue] = useState<Queue>()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [buildingId, setBuildingId] = useState('')
  const [openSwitch, setOpenSwitch] = useState(false)
  const [sub, setSub] = useState<SubMe>()
  const [owners, setOwners] = useState<OwnerRow[]>([])
  const [subs, setSubs] = useState<SubPay[]>([])
  const [loading, setLoading] = useState(true)
  const [floor, setFloor] = useState<number | 'all'>('all')

  useEffect(() => {
    if (role !== 'ADMIN' && role !== 'OWNER') return
    if (role === 'ADMIN') {
      Promise.all([
        api.get('/owners').then((r) => setOwners(r.data)).catch(() => {}),
        api.get('/subscriptions').then((r) => setSubs(r.data)).catch(() => {}),
      ]).finally(() => setLoading(false))
      return
    }
    Promise.all([
      api.get('/properties').then((r) => {
        setProps(r.data)
        if (r.data[0]) setBuildingId(r.data[0].id)
      }).catch(() => {}),
      api.get('/reports/dashboard').then((r) => setQueue(r.data)).catch(() => {}),
      api.get('/invoices').then((r) => setInvoices(r.data)).catch(() => {}),
      api.get('/subscriptions/me').then((r) => setSub(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [role])

  useEffect(() => {
    if (!isOwner || !buildingId) return
    api.get(`/properties/${buildingId}`).then((r) => setUnits(r.data.units || [])).catch(() => setUnits([]))
  }, [isOwner, buildingId])

  if (role !== 'OWNER' && role !== 'ADMIN') {
    return (
      <div className="p-4 pt-6 flex flex-col gap-3">
        <div className="h-8 w-40 rounded-button bg-surface-2" />
        <div className="h-36 rounded-hero bg-surface-2" />
        <div className="h-16 rounded-card bg-surface-2" />
      </div>
    )
  }

  if (role === 'ADMIN') {
    return <AdminHome loading={loading} owners={owners} subs={subs} />
  }

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const building = props.find((p) => p.id === buildingId) || props[0]
  const monthInvoices = invoices.filter(
    (i) => i.unit.propertyId === building?.id && i.month === month && i.year === year && i.status !== 'CANCELLED'
  )
  const collected = monthInvoices.filter((i) => i.status === 'PAID').reduce((a, i) => a + Number(i.total), 0)
  const waiting = monthInvoices.filter((i) => i.status === 'SLIP_UPLOADED').reduce((a, i) => a + Number(i.total), 0)
  const overdueAmt = monthInvoices.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + Number(i.total), 0)
  const billed = monthInvoices.reduce((a, i) => a + Number(i.total), 0)
  const pct = billed ? Math.round((collected / billed) * 100) : 0
  const waitPct = billed ? Math.round((waiting / billed) * 100) : 0

  const floors = Array.from(new Set(units.map((u) => u.floor ?? 0))).sort((a, b) => a - b)
  const shownFloor = floor === 'all' ? floors[0] : floor
  const grid = units.filter((u) => (u.floor ?? 0) === shownFloor)

  const tasks = queue?.tasks || []
  const slips = tasks.filter((t) => t.kind === 'slip')
  const tickets = tasks.filter((t) => t.kind === 'ticket')
  const meters = tasks.filter((t) => t.kind === 'meter')
  const meterRows = building ? meters.filter((t) => t.meta === building.name) : meters
  const contracts = tasks.filter((t) => t.kind === 'contract')

  const inbox: { key: string; href: string; title: string; meta: string; tone: 'warn' | 'danger' | 'info'; kind: string }[] = []
  if (slips.length) {
    inbox.push({
      key: 'slip',
      href: slips[0].href,
      title: `ตรวจสลิป ${slips.length} รายการ`,
      meta: slips.map((s) => s.meta).filter(Boolean).slice(0, 3).join(' · ') || slips[0].title,
      tone: 'warn',
      kind: 'slip',
    })
  }
  if (tickets.length === 1) {
    inbox.push({ key: tickets[0].id, href: tickets[0].href, title: tickets[0].title, meta: tickets[0].meta, tone: 'danger', kind: 'ticket' })
  } else if (tickets.length > 1) {
    inbox.push({
      key: 'tickets',
      href: tickets[0].href,
      title: `แจ้งซ่อมใหม่ ${tickets.length} เรื่อง`,
      meta: tickets[0].meta,
      tone: 'danger',
      kind: 'ticket',
    })
  }
  if (meterRows.length) {
    inbox.push({
      key: 'meter',
      href: meterRows[0].href,
      title: `จดมิเตอร์ ${thaiMonth(month)} เหลือ ${meterRows.length} ห้อง`,
      meta: meterRows[0].meta,
      tone: 'info',
      kind: 'meter',
    })
  }
  for (const c of contracts.slice(0, 3)) {
    inbox.push({ key: c.id, href: c.href, title: c.title, meta: c.meta, tone: 'info', kind: 'contract' })
  }

  const showBanner =
    sub &&
    (sub.owner.subscriptionStatus === 'GRACE' ||
      sub.owner.subscriptionStatus === 'SUSPENDED' ||
      (sub.owner.subscriptionStatus === 'TRIAL' && sub.owner.daysLeft != null && sub.owner.daysLeft <= 7))

  const bannerText =
    sub?.owner.subscriptionStatus === 'SUSPENDED'
      ? 'บัญชีถูกระงับ · ต่ออายุเพื่อแก้ไขข้อมูล'
      : sub?.owner.subscriptionStatus === 'GRACE'
        ? 'ช่วงผ่อนผัน · ต่ออายุก่อนระบบเปิดให้ดูอย่างเดียว'
        : `ทดลองใช้เหลือ ${sub?.owner.daysLeft ?? 0} วัน${sub?.bill ? ` · ต่ออายุ ${baht(sub.bill.amount)}` : ''}`

  return (
    <div className="pb-24">
      <div className="p-4 flex flex-col gap-3.5">
        {showBanner && (
          <div className="bg-warn-bg rounded-[14px] px-3.5 py-2.5 flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warn-fg shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-[13px] text-warn-fg">
              <strong>{bannerText}</strong>
            </span>
            <button type="button" className="text-[13px] font-bold text-warn-fg" onClick={() => nav('/admin/subscription')}>
              ต่ออายุ
            </button>
          </div>
        )}

        <header className="flex justify-between items-center">
          <div className="relative">
            <button type="button" className="flex flex-col items-start" onClick={() => setOpenSwitch((v) => !v)}>
              <span className="text-[13px] text-muted">อาคาร</span>
              <span className="flex items-center gap-1 font-display text-[22px] font-bold">
                {building?.name || 'ยังไม่มีอาคาร'}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            {openSwitch && props.length > 0 && (
              <div className="absolute z-10 mt-1 left-0 min-w-[220px] bg-white rounded-card border border-line-soft overflow-hidden">
                {props.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3.5 py-3 text-[15px] font-semibold border-b border-line-soft"
                    onClick={() => {
                      setBuildingId(p.id)
                      setFloor('all')
                      setOpenSwitch(false)
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="แจ้งเตือน"
            className="w-11 h-11 rounded-button border border-line-soft bg-white flex items-center justify-center"
            onClick={() => nav('/admin/notifications')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 21h4" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <section className="bg-white rounded-hero p-4 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted">รายรับ {thaiMonth(month)} {year + 543}</span>
            <span className="text-[13px] text-muted">เก็บได้ {pct}%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className="pf-amount text-[32px]">{baht(collected)}</strong>
            <span className="text-sm text-muted">/ {baht(billed)}</span>
          </div>
          <div className="h-2 rounded-full bg-segment flex overflow-hidden">
            <span className="bg-brand" style={{ width: `${pct}%` }} />
            <span className="bg-warn-chart" style={{ width: `${waitPct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted">ค้างชำระ</span>
              <strong className="text-base text-danger">{baht(overdueAmt)}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted">รอตรวจ</span>
              <strong className="text-base text-warn-fg">{baht(waiting)}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted">เข้าพัก</span>
              <strong className="text-base">
                {building ? `${building.stats.occupied}/${building.stats.total} ห้อง` : '0/0 ห้อง'}
              </strong>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-lg font-semibold">งานที่ต้องทำ</h2>
          {loading && <div className="h-16 rounded-card bg-surface-2" />}
          {!loading && inbox.length === 0 && <p className="text-sm text-muted">ไม่มีงานค้าง</p>}
          {inbox.map((row) => (
            <button
              key={row.key}
              type="button"
              className="bg-white rounded-card px-3.5 py-3 text-left text-ink flex items-center gap-3"
              onClick={() => nav(row.href)}
            >
              <TaskTile tone={row.tone} kind={row.kind} />
              <span className="flex-1 min-w-0 flex flex-col">
                <strong className="text-[15px]">{row.title}</strong>
                <span className={cls('text-[13px] truncate', row.tone === 'danger' ? 'text-danger' : 'text-muted')}>{row.meta}</span>
              </span>
              <span className="text-muted"><Chevron /></span>
            </button>
          ))}
        </section>

        <section className="bg-white rounded-hero px-4 py-3.5 flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline">
            <strong className="text-[15px]">ผังห้อง{shownFloor != null ? ` · ชั้น ${shownFloor || '-'}` : ''}</strong>
            {building && (
              <button type="button" className="text-[13px] font-semibold text-primary" onClick={() => nav(`/admin/property/${building.id}`)}>
                ทุกชั้น
              </button>
            )}
          </div>
          {floors.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {floors.map((f) => (
                <button
                  key={String(f)}
                  type="button"
                  aria-pressed={shownFloor === f}
                  className={cls(
                    'h-8 px-3 rounded-full text-[13px] font-semibold border shrink-0',
                    shownFloor === f ? 'bg-ink text-white border-ink' : 'bg-white border-line-soft'
                  )}
                  onClick={() => setFloor(f)}
                >
                  ชั้น {f || '-'}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5">
            {grid.map((u) => {
              const st = roomTone(u)
              return (
                <button
                  key={u.id}
                  type="button"
                  className={cls('h-10 rounded-[10px] text-[13px] font-bold', ROOM[st])}
                  onClick={() => nav(`/admin/unit/${u.id}`)}
                >
                  {u.roomNumber}
                </button>
              )
            })}
          </div>
          {!loading && grid.length === 0 && <p className="text-sm text-muted">ยังไม่มีห้องในชั้นนี้</p>}
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Legend className="bg-ok-bg border border-ok-fg" label="จ่ายแล้ว" />
            <Legend className="bg-warn-bg border border-warn-fg" label="รอตรวจ" />
            <Legend className="bg-danger" label="ค้าง" />
            <Legend className="bg-surface-2 border border-dashed border-placeholder" label="ว่าง" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <h2 className="m-0 font-display text-lg font-semibold">อาคารทั้งหมด</h2>
            <span className="text-[13px] text-muted">{props.length} อาคาร</span>
          </div>
          {!loading && props.length === 0 && (
            <p className="text-sm text-muted">ยังไม่มีอาคาร</p>
          )}
          {props.map((p, idx) => {
            const mine = invoices.filter((i) => i.unit.propertyId === p.id && i.status !== 'CANCELLED')
            const paid = mine.filter((i) => i.status === 'PAID' && i.month === month && i.year === year).reduce((a, i) => a + Number(i.total), 0)
            const due = mine.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + Number(i.total), 0)
            const maint = (queue?.newTickets || []).filter((t) => t.propertyName === p.name).length
            const rate = p.stats.total ? Math.round((p.stats.occupied / p.stats.total) * 100) : 0
            return (
              <button
                key={p.id}
                type="button"
                className="bg-white rounded-hero overflow-hidden text-left text-ink"
                onClick={() => nav(`/admin/property/${p.id}`)}
              >
                <div className={cls('h-[110px] px-4 py-3.5 flex items-end justify-between', idx % 2 ? 'bg-sidebar' : 'bg-hero')}>
                  <strong className="font-display text-[22px] text-white">{p.name}</strong>
                  <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-bold">{p.stats.total} ห้อง</span>
                </div>
                <div className="px-4 py-3.5 flex flex-col gap-2.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted">เข้าพัก</span>
                    <strong>{p.stats.occupied} / {p.stats.total}</strong>
                  </div>
                  <div className="h-2 rounded-full bg-segment">
                    <div className="h-2 rounded-full bg-brand" style={{ width: `${rate}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat k="รับแล้ว" v={baht(paid)} />
                    <Stat k="ค้าง" v={baht(due)} danger />
                    <Stat k="ซ่อมเปิดอยู่" v={String(maint)} />
                  </div>
                </div>
              </button>
            )
          })}
          <button
            type="button"
            className="h-14 rounded-card border-[1.5px] border-dashed border-placeholder bg-transparent text-primary text-[15px] font-bold"
            onClick={() => nav('/admin/property/new')}
          >
            + เพิ่มอาคารใหม่ (ต้องมีเลข PromptPay)
          </button>
        </section>
      </div>
      <BottomNav role="OWNER" />
    </div>
  )
}

function roomTone(u: UnitRow) {
  if (u.status === 'VACANT') return 'vacant'
  if (u.status === 'MAINTENANCE') return 'maint'
  const st = u.invoices[0]?.status
  if (st === 'PAID') return 'paid'
  if (st === 'SLIP_UPLOADED') return 'review'
  if (st === 'OVERDUE') return 'overdue'
  return 'pending'
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cls('w-2.5 h-2.5 rounded-[3px]', className)} />
      {label}
    </span>
  )
}

function Stat({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{k}</span>
      <strong className={cls('text-[15px]', danger && 'text-danger')}>{v}</strong>
    </div>
  )
}

function TaskTile({ tone, kind }: { tone: 'warn' | 'danger' | 'info'; kind: string }) {
  const bg = tone === 'warn' ? 'bg-warn-bg text-warn-fg' : tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-info-bg text-info'
  return (
    <span className={cls('w-10 h-10 rounded-button flex items-center justify-center shrink-0', bg)}>
      {kind === 'contract' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 8h8M8 12h8" strokeLinecap="round" />
        </svg>
      ) : kind === 'ticket' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : kind === 'meter' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13l4-4M12 5V3" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" strokeLinejoin="round" />
          <path d="M9 8h6M9 12h6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

function AdminHome({ loading, owners, subs }: { loading: boolean; owners: OwnerRow[]; subs: SubPay[] }) {
  const nav = useNavigate()
  const now = new Date()
  const revenue = subs
    .filter((s) => s.status === 'APPROVED')
    .filter((s) => {
      const d = new Date(s.approvedAt || s.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((a, s) => a + Number(s.amount), 0)

  const count = (st: string) => owners.filter((o) => (o.subscriptionStatus || 'TRIAL') === st).length
  const states = [
    { label: 'ทดลอง', n: count('TRIAL'), bg: 'bg-info-bg', fg: 'text-info' },
    { label: 'ใช้งาน', n: count('ACTIVE'), bg: 'bg-ok-bg', fg: 'text-ok-fg' },
    { label: 'ผ่อนผัน', n: count('GRACE'), bg: 'bg-warn-bg', fg: 'text-warn-fg' },
    { label: 'ระงับ', n: count('SUSPENDED'), bg: 'bg-danger-bg', fg: 'text-danger' },
  ]
  const pending = subs.filter((s) => s.status === 'UNDER_REVIEW')
  const oldest = pending
    .map((s) => new Date(s.slipUploadedAt || s.createdAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)[0]
  const ageHours = oldest ? Math.max(1, Math.round((Date.now() - oldest) / 36e5)) : 0

  const expiring = useMemo(() => {
    return owners
      .map((o) => {
        const days = o.expiresAt ? Math.ceil((new Date(o.expiresAt).getTime() - Date.now()) / 86400000) : null
        const st = o.subscriptionStatus || 'TRIAL'
        let tag = ''
        let tone = 'bg-neutral-bg text-ink-2'
        if (st === 'SUSPENDED') {
          tag = 'ระงับ'
          tone = 'bg-danger-bg text-danger'
        } else if (st === 'GRACE') {
          tag = 'ผ่อนผัน'
          tone = 'bg-warn-bg text-warn-fg'
        } else if (st === 'TRIAL') {
          tag = days != null && days >= 0 ? `ทดลอง ${days} วัน` : 'ทดลอง'
          tone = 'bg-info-bg text-info'
        } else if (days != null && days <= 7) {
          tag = days >= 0 ? `เหลือ ${days} วัน` : 'หมดอายุ'
          tone = 'bg-neutral-bg text-ink-2'
        }
        return { o, tag, tone, urgent: Boolean(tag) }
      })
      .filter((x) => x.urgent)
      .slice(0, 8)
  }, [owners])

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3.5">
        <header className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[13px] text-muted">แอดมินแพลตฟอร์ม</span>
            <strong className="font-display text-2xl">PropFlow</strong>
          </div>
          <span className="px-3 py-1 rounded-full bg-admin-bg text-admin-fg text-xs font-bold">ADMIN</span>
        </header>

        <section className="bg-white rounded-hero p-4 flex flex-col gap-3">
          <span className="text-sm text-muted">รายได้ค่าบริการเดือนนี้</span>
          <strong className="font-display text-[30px]">{loading ? '—' : baht(revenue)}</strong>
          <div className="grid grid-cols-4 gap-1.5">
            {states.map((s) => (
              <div key={s.label} className={cls('rounded-button py-2.5 px-1 flex flex-col items-center gap-0.5', s.bg)}>
                <strong className={cls('text-xl', s.fg)}>{s.n}</strong>
                <span className={cls('text-[11px] font-bold', s.fg)}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="bg-white rounded-card px-3.5 py-3 text-left text-ink flex items-center gap-3"
          onClick={() => nav('/admin/subscriptions')}
        >
          <span className="w-10 h-10 rounded-button bg-warn-bg text-warn-fg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
              <path d="M9 8h6M9 12h6" strokeLinecap="round" />
            </svg>
          </span>
          <span className="flex-1 flex flex-col">
            <strong className="text-[15px]">สลิปค่าบริการรอตรวจ {pending.length}</strong>
            <span className="text-[13px] text-muted">{ageHours ? `เก่าสุด ${ageHours} ชม.` : 'ไม่มีรายการค้าง'}</span>
          </span>
          <span className="text-muted"><Chevron /></span>
        </button>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 font-display text-lg font-semibold">ใกล้หมดอายุ / ค้างจ่าย</h2>
          <div className="bg-white rounded-card overflow-hidden">
            {expiring.length === 0 && <p className="px-3.5 py-4 text-sm text-muted">ไม่มีบัญชีใกล้หมดอายุ</p>}
            {expiring.map(({ o, tag, tone }) => (
              <button
                key={o.id}
                type="button"
                className="w-full px-3.5 py-3 border-b border-line-soft text-left flex items-center gap-3"
                onClick={() => nav('/admin/owners')}
              >
                <span className="flex-1 flex flex-col min-w-0">
                  <strong className="text-[15px] truncate">{o.name}</strong>
                  <span className="text-xs text-muted truncate">
                    {o.username || '—'} · {o.properties.length} อาคาร
                  </span>
                </span>
                <span className={cls('px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap', tone)}>{tag}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
