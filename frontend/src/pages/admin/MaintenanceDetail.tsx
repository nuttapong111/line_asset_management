import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { cls, thaiDateTime } from '../../lib/utils'

interface Msg { id: string; senderName: string; senderRole: string; message: string; createdAt: string }
interface Ticket {
  id: string
  ticketNo: string
  title: string
  description?: string
  category: string
  status: string
  photoUrls: string[]
  scheduledAt?: string
  scheduleSlot?: string
  technicianName?: string
  createdAt: string
  unit: { roomNumber: string; property?: { name: string } }
  messages: Msg[]
}

const SLOTS = ['09–12', '13–16', '16–18']

function startOfToday(from = new Date()) {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  return d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
const CAT: Record<string, string> = { ELECTRIC: 'ไฟฟ้า', PLUMBING: 'ประปา', APPLIANCE: 'เครื่องใช้', GENERAL: 'ทั่วไป' }

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] text-ink bg-white'

export default function MaintenanceDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState<Ticket>()
  const [msg, setMsg] = useState('')
  const [slot, setSlot] = useState(SLOTS[1])
  const [tech, setTech] = useState('')
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Date>(() => startOfToday())
  const [cursor, setCursor] = useState(() => {
    const d = startOfToday()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const load = () => api.get(`/maintenance/${id}`).then((r) => {
    setTicket(r.data)
    if (r.data.technicianName) setTech(r.data.technicianName)
    if (r.data.scheduleSlot && SLOTS.includes(r.data.scheduleSlot)) setSlot(r.data.scheduleSlot)
    if (r.data.scheduledAt) {
      const d = startOfToday(new Date(r.data.scheduledAt))
      if (d >= startOfToday()) {
        setPicked(d)
        setCursor({ y: d.getFullYear(), m: d.getMonth() })
      }
    }
  })
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const calendar = useMemo(() => {
    const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: (Date | null)[] = Array.from({ length: firstDow }, () => null)
    for (let n = 1; n <= count; n++) cells.push(new Date(cursor.y, cursor.m, n))
    const today = startOfToday()
    const canPrev = cursor.y > today.getFullYear() || (cursor.y === today.getFullYear() && cursor.m > today.getMonth())
    const label = new Date(cursor.y, cursor.m, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    return { cells, canPrev, label, today }
  }, [cursor])

  if (!ticket) {
    return (
      <div>
        <TopBar title="ใบงานซ่อม" />
        <div className="p-4"><div className="h-24 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  const minutes = Math.max(1, Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000))
  const whenIso = (() => {
    const d = new Date(picked)
    const hour = slot.startsWith('09') ? 9 : slot.startsWith('13') ? 13 : 16
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  })()

  async function ackOnly() {
    setBusy(true)
    try {
      await api.put(`/maintenance/${id}/status`, { status: 'ACKNOWLEDGED' })
      if (msg.trim()) await api.post(`/maintenance/${id}/messages`, { message: msg.trim() })
      setMsg('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function ackAndSchedule() {
    setBusy(true)
    try {
      await api.put(`/maintenance/${id}/schedule`, { scheduledAt: whenIso, scheduleSlot: slot, technicianName: tech })
      if (msg.trim()) await api.post(`/maintenance/${id}/messages`, { message: msg.trim() })
      setMsg('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-28">
      <TopBar title={ticket.title} sub={`${ticket.ticketNo} · ${ticket.unit.roomNumber} · ${CAT[ticket.category] || ticket.category}`} />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        {ticket.status === 'NEW' && (
          <div className="bg-danger-bg rounded-[14px] px-3.5 py-2.5 flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger shrink-0" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            <span className="text-sm text-danger">
              <strong>ใหม่ · ยังไม่รับเรื่อง {minutes} นาที</strong> ผู้เช่าเห็นสถานะนี้อยู่
            </span>
          </div>
        )}

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2.5">
          {ticket.description && <span className="text-sm leading-relaxed">“{ticket.description}”</span>}
          {ticket.photoUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {ticket.photoUrls.map((u, i) => (
                <img key={u} src={u} alt={`รูป ${i + 1}`} className="w-[72px] h-[72px] rounded-[10px] object-cover bg-surface-2" />
              ))}
            </div>
          )}
          <span className="text-xs text-muted">{thaiDateTime(ticket.createdAt)}</span>
        </section>

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-3">
          <strong className="text-sm">นัดช่าง (ไม่บังคับ)</strong>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="เดือนก่อน"
              disabled={!calendar.canPrev}
              className="w-9 h-9 rounded-full border border-line-soft text-ink disabled:opacity-30"
              onClick={() => setCursor((c) => {
                const d = new Date(c.y, c.m - 1, 1)
                return { y: d.getFullYear(), m: d.getMonth() }
              })}
            >
              ‹
            </button>
            <strong className="text-sm">{calendar.label}</strong>
            <button
              type="button"
              aria-label="เดือนถัดไป"
              className="w-9 h-9 rounded-full border border-line-soft text-ink"
              onClick={() => setCursor((c) => {
                const d = new Date(c.y, c.m + 1, 1)
                return { y: d.getFullYear(), m: d.getMonth() }
              })}
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((w) => (
              <span key={w} className="text-[11px] text-muted py-1">{w}</span>
            ))}
            {calendar.cells.map((date, i) => {
              if (!date) return <span key={`e-${i}`} />
              const disabled = date < calendar.today
              const on = sameDay(date, picked)
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  className={cls(
                    'h-9 rounded-lg text-sm',
                    on ? 'bg-primary text-white font-bold' : 'bg-white text-ink',
                    disabled && 'text-muted opacity-40'
                  )}
                  onClick={() => setPicked(date)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
          <div className="flex gap-1.5">
            {SLOTS.map((s) => {
              const on = slot === s
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  className={cls(
                    'flex-1 h-[38px] rounded-[10px] text-[13px]',
                    on ? 'border-2 border-primary bg-primary-soft text-ok-fg font-bold' : 'border-[1.5px] border-line-soft bg-white font-semibold'
                  )}
                  onClick={() => setSlot(s)}
                >
                  {s}
                </button>
              )
            })}
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            ช่าง
            <input className={fieldCls} value={tech} onChange={(e) => setTech(e.target.value)} placeholder="ชื่อช่าง" />
          </label>
          {ticket.scheduledAt && (
            <p className="text-xs text-muted">นัดล่าสุด {thaiDateTime(ticket.scheduledAt)} {ticket.scheduleSlot || ''} {ticket.technicianName || ''}</p>
          )}
        </section>

        {ticket.messages.length > 0 && (
          <div className="flex flex-col gap-2">
            {ticket.messages.map((m) => (
              <div key={m.id} className={cls('max-w-[85%] text-sm px-3 py-2', m.senderRole === 'TENANT' ? 'bg-white rounded-[16px] rounded-bl-[4px]' : 'bg-primary text-white self-end rounded-[16px] rounded-br-[4px]')}>
                <span className={cls('text-[11px] block', m.senderRole === 'TENANT' ? 'text-muted' : 'text-white/80')}>{m.senderName}</span>
                {m.message}
              </div>
            ))}
          </div>
        )}

        <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          ข้อความถึงผู้เช่า
          <input className={fieldCls} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="รับเรื่องแล้ว" />
        </label>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-[1fr_1.6fr] gap-2.5">
        <button type="button" className="h-[52px] rounded-cta border-[1.5px] border-line-soft bg-white text-[15px] font-semibold disabled:opacity-50" onClick={ackOnly} disabled={busy}>
          รับเรื่องอย่างเดียว
        </button>
        <button type="button" className="h-[52px] rounded-cta bg-primary text-white text-[15px] font-bold disabled:opacity-50" onClick={ackAndSchedule} disabled={busy}>
          รับเรื่อง + นัดช่าง
        </button>
      </div>
    </div>
  )
}
