import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { thaiDate } from '../../lib/utils'

interface Ticket {
  id: string
  ticketNo: string
  title: string
  category: string
  status: string
  createdAt: string
  scheduledAt?: string | null
  scheduleSlot?: string | null
  technicianName?: string | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'แจ้งใหม่', cls: 'bg-danger-bg text-danger' },
  ACKNOWLEDGED: { label: 'รับเรื่อง', cls: 'bg-info-bg text-info' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', cls: 'bg-warn-bg text-warn-fg' },
  SCHEDULED: { label: 'นัดช่างแล้ว', cls: 'bg-warn-bg text-warn-fg' },
  DONE: { label: 'เสร็จแล้ว', cls: 'bg-ok-bg text-ok-fg' },
  CLOSED: { label: 'ปิดงาน', cls: 'bg-neutral-bg text-neutral-fg' },
}

const CAT: Record<string, string> = { ELECTRIC: 'ไฟฟ้า', PLUMBING: 'ประปา', APPLIANCE: 'เครื่องใช้', GENERAL: 'ทั่วไป' }
const ORDER = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED', 'DONE', 'CLOSED']

export default function MaintenanceList() {
  const nav = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/maintenance')
      .then((r) => setTickets(r.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pb-28">
      <div className="px-4 pt-5 flex flex-col gap-4">
        <h1 className="font-display text-[26px] font-bold m-0">แจ้งซ่อม</h1>
        {loading && <div className="h-24 rounded-card bg-surface-2" />}
        {!loading && tickets.length === 0 && <p className="text-sm text-muted">ยังไม่มีเรื่องแจ้งซ่อม</p>}
        {tickets.map((t) => {
          const st = STATUS[t.status] || STATUS.NEW
          const idx = Math.max(0, ORDER.indexOf(t.status))
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => nav(`/tenant/maintenance/${t.id}`)}
              className="bg-white rounded-card px-4 py-3.5 text-left text-ink flex flex-col gap-2.5"
            >
              <div className="flex justify-between items-center gap-2">
                <span className="text-[13px] text-muted">
                  {t.ticketNo} · {CAT[t.category] || t.category}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              <strong className="text-[15px]">{t.title}</strong>
              <div className="flex gap-1" aria-label={`ความคืบหน้า ${idx + 1} จาก 6`}>
                {ORDER.map((step, i) => (
                  <span key={step} className={`flex-1 h-1 rounded ${i <= idx ? 'bg-primary' : 'bg-[#DCE3DF]'}`} />
                ))}
              </div>
              <span className="text-[13px] text-muted">{scheduleLine(t)}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => nav('/tenant/maintenance/new')}
          className="h-[52px] rounded-cta bg-primary text-white font-bold text-[17px]"
        >
          แจ้งเรื่องใหม่
        </button>
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}

function scheduleLine(t: Ticket) {
  if (!t.scheduledAt) return thaiDate(t.createdAt)
  const when = new Date(t.scheduledAt).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
  return `ช่างเข้า ${when}${t.scheduleSlot ? ` ${t.scheduleSlot}` : ''}${t.technicianName ? ` · ${t.technicianName}` : ''}`
}
