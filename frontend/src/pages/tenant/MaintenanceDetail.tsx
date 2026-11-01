import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { thaiDateTime } from '../../lib/utils'

interface Msg {
  id: string
  senderName: string
  senderRole: string
  message: string
  createdAt: string
}
interface Ticket {
  id: string
  ticketNo: string
  title: string
  description?: string
  category: string
  status: string
  scheduledAt?: string
  scheduleSlot?: string
  technicianName?: string
  appointmentStatus?: string | null
  doneConfirmedAt?: string | null
  unit: { roomNumber: string }
  messages: Msg[]
}

const CAT: Record<string, string> = { ELECTRIC: 'ไฟฟ้า', PLUMBING: 'ประปา', APPLIANCE: 'เครื่องใช้', GENERAL: 'ทั่วไป' }
const LABELS = ['แจ้งแล้ว', 'รับเรื่อง', 'กำลังดำเนินการ', 'นัดช่าง', 'เสร็จแล้ว']
const ORDER = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED', 'DONE']

export default function MaintenanceDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState<Ticket>()
  const [msg, setMsg] = useState('')

  const load = () => api.get(`/maintenance/${id}`).then((r) => setTicket(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!ticket) return <div className="p-6"><div className="h-40 rounded-card bg-surface-2" /></div>

  const cur = ticket.status === 'CLOSED' ? 4 : Math.max(0, ORDER.indexOf(ticket.status))
  const openAppt = Boolean(ticket.scheduledAt) && !['DONE', 'CLOSED'].includes(ticket.status)

  async function send() {
    if (!msg.trim()) return
    await api.post(`/maintenance/${id}/messages`, { message: msg.trim() })
    setMsg('')
    load()
  }
  async function confirmDone() {
    await api.put(`/maintenance/${id}/confirm-done`)
    load()
  }
  async function respond(action: 'confirm' | 'reschedule') {
    let note: string | undefined
    if (action === 'reschedule') {
      const entered = window.prompt('ช่วงเวลาที่สะดวก')
      if (entered === null) return
      note = entered || undefined
    }
    await api.put(`/maintenance/${id}/appointment`, { action, note })
    load()
  }

  return (
    <div className="h-screen flex flex-col bg-canvas">
      <TopBar title={ticket.title} sub={`${ticket.ticketNo} · ${CAT[ticket.category] || ticket.category}`} />
      <div className="bg-white px-4 py-3.5 border-b border-[#EEF1EF] flex flex-col gap-3">
        <ol aria-label="สถานะ" className="m-0 p-0 list-none grid grid-cols-5 gap-1">
          {LABELS.map((label, i) => {
            const on = i <= cur
            const current = i === cur && ticket.status !== 'DONE' && ticket.status !== 'CLOSED'
            return (
              <li key={label} className="flex flex-col gap-1.5 items-start min-w-0">
                <span className={`w-full h-1 rounded ${current ? 'bg-warn-fg' : on ? 'bg-primary' : 'bg-[#DCE3DF]'}`} />
                <span className={`text-[11px] leading-tight ${current ? 'font-bold text-warn-fg' : on ? 'font-bold text-primary' : 'font-semibold text-muted'}`}>
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
        {openAppt && (
          <div className="bg-warn-bg rounded-cta px-3.5 py-3 flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warn-fg shrink-0" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <div className="flex-1 flex flex-col min-w-0">
              <strong className="text-sm text-warn-fg">
                นัดช่าง {thaiDateTime(ticket.scheduledAt)}
                {ticket.scheduleSlot ? ` ${ticket.scheduleSlot}` : ''}
              </strong>
              <span className="text-xs text-warn-fg">
                {ticket.technicianName ? `ช่าง${ticket.technicianName} · ` : ''}
                จะมีคนอยู่ห้องไหม?
              </span>
            </div>
          </div>
        )}
        {openAppt && ticket.appointmentStatus === 'CONFIRMED' && <p className="text-sm text-ok-fg font-semibold">ยืนยันนัดแล้ว</p>}
        {openAppt && ticket.appointmentStatus === 'RESCHEDULE' && <p className="text-sm text-warn-fg font-semibold">ส่งคำขอเลื่อนนัดแล้ว</p>}
        {openAppt && !ticket.appointmentStatus && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => respond('reschedule')} className="h-10 rounded-input border-[1.5px] border-[#DCE3DF] bg-white text-sm font-semibold">
              ขอเลื่อนนัด
            </button>
            <button type="button" onClick={() => respond('confirm')} className="h-10 rounded-input bg-primary text-white text-sm font-bold">
              ยืนยันนัด
            </button>
          </div>
        )}
        {ticket.status === 'DONE' && !ticket.doneConfirmedAt && (
          <button type="button" onClick={confirmDone} className="h-[52px] rounded-cta bg-primary text-white font-bold text-[17px]">
            ยืนยันว่าซ่อมเสร็จ
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 flex flex-col gap-2.5">
        {ticket.description && (
          <div className="self-end max-w-[250px] bg-primary text-white rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-sm leading-normal">
            {ticket.description}
          </div>
        )}
        {ticket.messages.map((m) => {
          const mine = m.senderRole === 'TENANT'
          if (mine) {
            return (
              <div key={m.id} className="self-end max-w-[250px] flex flex-col items-end gap-1">
                <div className="bg-primary text-white rounded-[16px_16px_4px_16px] px-3.5 py-2.5 text-sm leading-normal">{m.message}</div>
                <span className="text-[11px] text-muted">{thaiDateTime(m.createdAt)}</span>
              </div>
            )
          }
          return (
            <div key={m.id} className="self-start flex gap-2 max-w-[280px]">
              <span className="w-8 h-8 rounded-full bg-primary-soft text-primary text-[13px] font-bold flex items-center justify-center shrink-0">
                {m.senderName.slice(0, 1)}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">{m.senderName}</span>
                <div className="bg-white rounded-[16px_16px_16px_4px] px-3.5 py-2.5 text-sm leading-normal">{m.message}</div>
              </div>
            </div>
          )
        })}
        {ticket.messages.length === 0 && !ticket.description && <p className="text-sm text-muted text-center">ยังไม่มีข้อความ</p>}
      </div>

      <div className="bg-white border-t border-[#EEF1EF] px-3 pt-2.5 pb-6 flex gap-2 items-center">
        <input
          aria-label="ข้อความ"
          placeholder="พิมพ์ข้อความถึงเจ้าของ"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
          className="flex-1 min-w-0 h-11 box-border border-[1.5px] border-[#DCE3DF] rounded-full px-4 text-[15px] outline-none focus:border-primary"
        />
        <button type="button" aria-label="ส่ง" onClick={send} className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12 20 4l-6 16-3-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
