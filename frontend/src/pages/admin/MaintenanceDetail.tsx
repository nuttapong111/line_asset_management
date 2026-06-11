import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { thaiDateTime } from '../../lib/utils'

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
  createdAt: string
  unit: { roomNumber: string }
  messages: Msg[]
}

const STATUSES = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED', 'DONE', 'CLOSED']
const STATUS_TH: Record<string, string> = {
  NEW: 'แจ้งใหม่', ACKNOWLEDGED: 'รับเรื่อง', IN_PROGRESS: 'กำลังซ่อม', SCHEDULED: 'นัดหมาย', DONE: 'เสร็จแล้ว', CLOSED: 'ปิดงาน',
}

export default function MaintenanceDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState<Ticket>()
  const [msg, setMsg] = useState('')

  const load = () => api.get(`/maintenance/${id}`).then((r) => setTicket(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!ticket) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  async function setStatus(status: string) {
    await api.put(`/maintenance/${id}/status`, { status })
    load()
  }
  async function send() {
    if (!msg) return
    await api.post(`/maintenance/${id}/messages`, { message: msg })
    setMsg('')
    load()
  }

  return (
    <div className="pb-4">
      <TopBar title={ticket.ticketNo} />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{ticket.title}</h3>
              <p className="text-gray-400 text-sm">ห้อง {ticket.unit.roomNumber} · {ticket.category}</p>
            </div>
            <Badge kind="info">{STATUS_TH[ticket.status]}</Badge>
          </div>
          {ticket.description && <p className="text-sm text-gray-600 mt-2">{ticket.description}</p>}
          {ticket.photoUrls.length > 0 && (
            <div className="flex gap-2 mt-3 overflow-x-auto">
              {ticket.photoUrls.map((u) => <img key={u} src={u} className="w-20 h-20 rounded-lg object-cover" />)}
            </div>
          )}
        </Card>

        <Card>
          <h4 className="font-semibold mb-2">อัปเดตสถานะ</h4>
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map((st) => (
              <button
                key={st}
                onClick={() => setStatus(st)}
                className={`px-3 py-1.5 rounded-full text-sm border ${ticket.status === st ? 'bg-line text-white border-line' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {STATUS_TH[st]}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h4 className="font-semibold mb-2">ข้อความ</h4>
          <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`text-sm ${m.senderRole === 'ADMIN' ? 'text-right' : ''}`}>
                <span className="inline-block bg-gray-100 rounded-xl px-3 py-2">
                  <span className="text-[10px] text-gray-400 block">{m.senderName} · {thaiDateTime(m.createdAt)}</span>
                  {m.message}
                </span>
              </div>
            ))}
            {ticket.messages.length === 0 && <p className="text-gray-400 text-sm">ยังไม่มีข้อความ</p>}
          </div>
          <div className="flex gap-2">
            <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="พิมพ์ข้อความ..." />
            <Button className="w-auto px-4" onClick={send}>ส่ง</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
