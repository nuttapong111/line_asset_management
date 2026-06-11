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
  unit: { roomNumber: string }
  messages: Msg[]
}

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

  async function send() {
    if (!msg) return
    await api.post(`/maintenance/${id}/messages`, { message: msg })
    setMsg('')
    load()
  }
  async function confirmDone() {
    await api.post(`/maintenance/${id}/messages`, { message: 'ยืนยันว่างานซ่อมเสร็จเรียบร้อย ขอบคุณครับ' })
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
              <p className="text-gray-400 text-sm">ห้อง {ticket.unit.roomNumber}</p>
            </div>
            <Badge kind={['DONE', 'CLOSED'].includes(ticket.status) ? 'paid' : 'info'}>{STATUS_TH[ticket.status]}</Badge>
          </div>
          {ticket.description && <p className="text-sm text-gray-600 mt-2">{ticket.description}</p>}
        </Card>

        {ticket.scheduledAt && (
          <Card className="border-info bg-blue-50">
            <p className="text-sm text-blue-700">นัดหมายซ่อม: {thaiDateTime(ticket.scheduledAt)}</p>
          </Card>
        )}

        <Card>
          <h4 className="font-semibold mb-2">ข้อความ</h4>
          <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`text-sm ${m.senderRole === 'TENANT' ? 'text-right' : ''}`}>
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

        {ticket.status === 'DONE' && <Button onClick={confirmDone}>ยืนยันเสร็จสิ้น</Button>}
      </div>
    </div>
  )
}
