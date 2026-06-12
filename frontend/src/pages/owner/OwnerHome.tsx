import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge, Chip } from '../../components/ui'
import { baht, thaiDateTime } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface Summary {
  summary: { collected: number; pending: number; overdue: number }
  properties: { id: string; name: string; units: number; occupied: number }[]
}
interface Payment {
  id: string
  status: string
  createdAt: string
  tenant: { name: string }
  invoice: { total: string; unit: { roomNumber: string } }
}
interface Ticket {
  id: string
  ticketNo: string
  title: string
  status: string
  createdAt: string
  unit: { roomNumber: string }
}

const PAY_BADGE: Record<string, { kind: any; label: string }> = {
  WAITING_SLIP: { kind: 'gray', label: 'รอสลิป' },
  UNDER_REVIEW: { kind: 'pending', label: 'รอตรวจสอบ' },
  APPROVED: { kind: 'paid', label: 'ชำระแล้ว' },
  REJECTED: { kind: 'overdue', label: 'ปฏิเสธ' },
}
const MAINT_BADGE: Record<string, { kind: any; label: string }> = {
  NEW: { kind: 'overdue', label: 'ใหม่' },
  ACKNOWLEDGED: { kind: 'info', label: 'รับเรื่อง' },
  IN_PROGRESS: { kind: 'pending', label: 'กำลังซ่อม' },
  SCHEDULED: { kind: 'info', label: 'นัดหมาย' },
  DONE: { kind: 'paid', label: 'เสร็จสิ้น' },
  CLOSED: { kind: 'gray', label: 'ปิดงาน' },
}

export default function OwnerHome() {
  const nav = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const [data, setData] = useState<Summary>()
  const [payments, setPayments] = useState<Payment[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tab, setTab] = useState<'pay' | 'maint'>('pay')

  useEffect(() => {
    api.get('/owner/summary').then((r) => setData(r.data)).catch(() => {})
    api.get('/owner/payments').then((r) => setPayments(r.data)).catch(() => {})
    api.get('/owner/maintenance').then((r) => setTickets(r.data)).catch(() => {})
  }, [])

  return (
    <div className="pb-10">
      <div className="bg-line text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-white/80 text-sm">เจ้าของทรัพย์สิน</p>
            <h1 className="text-xl font-bold">{user?.name || 'เจ้าของ'}</h1>
          </div>
          <button onClick={() => { clearAuth(); window.location.reload() }} className="text-white/80 text-sm underline">
            ออก
          </button>
        </div>
      </div>

      <div className="px-4 -mt-5 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Card className="text-center !p-3">
            <p className="text-xs text-gray-400">รับแล้ว</p>
            <p className="font-bold text-line text-sm">{baht(data?.summary.collected)}</p>
          </Card>
          <Card className="text-center !p-3">
            <p className="text-xs text-gray-400">รอตรวจ/ค้าง</p>
            <p className="font-bold text-amber-600 text-sm">{baht(data?.summary.pending)}</p>
          </Card>
          <Card className="text-center !p-3">
            <p className="text-xs text-gray-400">เกินกำหนด</p>
            <p className="font-bold text-red-500 text-sm">{baht(data?.summary.overdue)}</p>
          </Card>
        </div>

        {data?.properties?.length ? (
          <Card>
            <h3 className="font-semibold mb-2 text-sm">ทรัพย์สินที่ดูแล</h3>
            {data.properties.map((p) => (
              <div key={p.id} className="flex justify-between text-sm py-1">
                <span>{p.name}</span>
                <span className="text-gray-400">{p.occupied}/{p.units} ห้อง</span>
              </div>
            ))}
          </Card>
        ) : null}

        <div className="flex gap-2">
          <Chip active={tab === 'pay'} onClick={() => setTab('pay')}>การชำระเงิน</Chip>
          <Chip active={tab === 'maint'} onClick={() => setTab('maint')}>แจ้งซ่อม</Chip>
        </div>

        {tab === 'pay' && (
          <div className="space-y-2">
            {payments.length === 0 && <p className="text-center text-gray-400 text-sm py-6">ยังไม่มีรายการ</p>}
            {payments.map((p) => {
              const b = PAY_BADGE[p.status] || { kind: 'gray', label: p.status }
              return (
                <Card key={p.id} onClick={() => nav(`/owner/payment/${p.id}`)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">ห้อง {p.invoice.unit.roomNumber} · {p.tenant.name}</p>
                      <p className="text-xs text-gray-400">{thaiDateTime(p.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{baht(p.invoice.total)}</p>
                      <Badge kind={b.kind}>{b.label}</Badge>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {tab === 'maint' && (
          <div className="space-y-2">
            {tickets.length === 0 && <p className="text-center text-gray-400 text-sm py-6">ยังไม่มีรายการ</p>}
            {tickets.map((t) => {
              const b = MAINT_BADGE[t.status] || { kind: 'gray', label: t.status }
              return (
                <Card key={t.id} onClick={() => nav(`/owner/maintenance/${t.id}`)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.ticketNo} · ห้อง {t.unit.roomNumber} · {thaiDateTime(t.createdAt)}</p>
                    </div>
                    <Badge kind={b.kind}>{b.label}</Badge>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
