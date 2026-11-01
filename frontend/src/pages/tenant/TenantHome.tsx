import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../hooks/useAuth'
import { bahtExact, thaiMonth } from '../../lib/utils'

interface Invoice {
  id: string
  type?: string
  month: number
  year: number
  total: string
  status: string
  dueDate: string
  usedElec?: number | null
  usedWater?: number | null
  unit: { roomNumber: string }
}

interface Post {
  id: string
  title?: string
  body: string
  pinned: boolean
  hidden?: boolean
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอชำระ', cls: 'bg-info-bg text-info' },
  OVERDUE: { label: 'เลยกำหนด', cls: 'bg-danger-bg text-danger' },
  SLIP_UPLOADED: { label: 'รอตรวจสลิป', cls: 'bg-warn-bg text-warn-fg' },
  PAID: { label: 'ชำระแล้ว', cls: 'bg-ok-bg text-ok-fg' },
}

const TYPE_TH: Record<string, string> = { RENT: 'ค่าเช่า', UTILITY: 'ค่าน้ำไฟ', SHORTFALL: 'ส่วนต่าง', CONTRACT: 'ค่าแรกเข้า' }

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

function daysLeft(due: string) {
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000)
}

const SHORTCUTS = [
  { label: 'ใบเสร็จ', path: '/documents', d: 'M6 3h9l4 4v14H6zM9 12h7M9 16h5' },
  { label: 'สัญญา', path: '/contract', d: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4' },
  { label: 'แจ้งซ่อม', path: '/tenant/maintenance', d: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z' },
  { label: 'ติดต่อ', path: '/contact', d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2' },
]

export default function TenantHome() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pinned, setPinned] = useState<Post>()
  const [place, setPlace] = useState<{ property?: string; room?: string }>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/invoices').then((r) => setInvoices(r.data)).catch(() => {}),
      api
        .get('/community/posts')
        .then((r) => setPinned((r.data as Post[]).find((p) => p.pinned && !p.hidden)))
        .catch(() => {}),
      api
        .get('/contracts/me')
        .then((r) =>
          setPlace({
            property: r.data?.unit?.property?.name,
            room: r.data?.unit?.roomNumber,
          })
        )
        .catch(() => {}),
    ]).finally(() => setLoaded(true))
  }, [])

  const due = invoices.filter((i) => ['PENDING', 'OVERDUE'].includes(i.status))
  const dueTotal = due.reduce((s, i) => s + Number(i.total), 0)
  const room = place.room || invoices[0]?.unit.roomNumber
  const placeLabel = [place.property, room].filter(Boolean).join(' · ')
  const latest = invoices.slice(0, 3)

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm text-muted">สวัสดีครับ</span>
            <strong className="font-display text-[22px] font-bold leading-tight truncate">{user?.name || 'ผู้เช่า'}</strong>
          </div>
          {placeLabel && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#DCE3DF] text-[13px] font-semibold text-ink shrink-0">
              <span className="text-primary flex">
                <Icon d="M3 10.5 12 3l9 7.5V20H3z" size={16} />
              </span>
              {placeLabel}
            </span>
          )}
        </header>

        {!loaded ? (
          <div className="h-56 rounded-hero bg-surface-2" />
        ) : (
          <section className="bg-hero text-white rounded-[22px] p-5 flex flex-col gap-3.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-primary-soft">ยอดที่ต้องชำระทั้งหมด</span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs font-bold">{due.length} บิล</span>
            </div>
            <strong className="pf-amount text-[38px] leading-none">{bahtExact(dueTotal)}</strong>
            <div className="flex flex-col gap-1.5 text-sm">
              {due.slice(0, 3).map((b) => (
                <div key={b.id} className="flex justify-between gap-2">
                  <span className="text-primary-soft">
                    {TYPE_TH[b.type || 'RENT']} {thaiMonth(b.month)}
                  </span>
                  <span>
                    {bahtExact(b.total)} · ครบ {new Date(b.dueDate).getDate()} {thaiMonth(new Date(b.dueDate).getMonth() + 1)}
                  </span>
                </div>
              ))}
              {due.length === 0 && <span className="text-primary-soft">ไม่มียอดค้างชำระ</span>}
            </div>
            {due.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => nav('/pay')}
                  className="h-[52px] rounded-cta bg-brand text-ink font-bold text-[17px] flex items-center justify-center gap-2"
                >
                  <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M21 14v7h-7" size={20} />
                  {due.length > 1 ? 'จ่ายรวมครั้งเดียว' : 'ชำระเงิน'}
                </button>
                {due.length > 1 && (
                  <span className="text-xs text-primary-soft text-center -mt-1">หรือแตะบิลด้านล่างเพื่อจ่ายแยก</span>
                )}
              </>
            )}
          </section>
        )}

        <section className="grid grid-cols-4 gap-2">
          {SHORTCUTS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => nav(s.path)}
              className="bg-white rounded-card py-3 flex flex-col items-center gap-1.5 text-[13px] font-semibold text-ink"
            >
              <span className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <Icon d={s.d} />
              </span>
              {s.label}
            </button>
          ))}
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline">
            <h2 className="font-display text-lg font-semibold">บิลล่าสุด</h2>
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => nav('/documents')}>
              ดูทั้งหมด
            </button>
          </div>
          {latest.map((i) => {
            const st = STATUS[i.status] || STATUS.PENDING
            const left = daysLeft(i.dueDate)
            const when =
              left > 0 ? `อีก ${left} วัน` : left === 0 ? 'ครบกำหนดวันนี้' : `เลย ${-left} วัน`
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => nav(i.status === 'PAID' ? `/tenant/invoice/${i.id}` : `/payment/${i.id}`)}
                className="bg-white rounded-card px-4 py-3.5 text-left flex justify-between items-center gap-3"
              >
                <div className="min-w-0">
                  <strong className="text-[15px] block">
                    {TYPE_TH[i.type || 'RENT']} · {thaiMonth(i.month)} {i.year + 543}
                  </strong>
                  <span className="text-[13px] text-muted">
                    {bahtExact(i.total)}
                    {i.type === 'UTILITY' && (i.usedElec != null || i.usedWater != null)
                      ? ` · ไฟ ${i.usedElec ?? '—'} น้ำ ${i.usedWater ?? '—'} หน่วย`
                      : ''}
                    {['PENDING', 'OVERDUE'].includes(i.status) ? ` · ${when}` : ''}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
              </button>
            )
          })}
          {loaded && latest.length === 0 && <p className="text-muted text-sm">ยังไม่มีบิล</p>}
        </section>

        {pinned && (
          <section className="bg-white rounded-card px-4 py-3.5 flex gap-3 items-start">
            <span className="w-9 h-9 rounded-[10px] bg-warn-bg text-warn-fg flex items-center justify-center shrink-0">
              <Icon d="M4 10v4h3l6 5V5L7 10zM17 9a4 4 0 0 1 0 6" size={20} />
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-bold text-warn-fg">ประกาศปักหมุด</span>
              <strong className="text-[15px]">{pinned.title || 'ประกาศ'}</strong>
              <span className="text-[13px] text-muted line-clamp-2">{pinned.body}</span>
            </div>
          </section>
        )}
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
