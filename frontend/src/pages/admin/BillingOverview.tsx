import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiMonth } from '../../lib/utils'

interface Invoice {
  id: string
  month: number
  year: number
  total: string
  status: string
  unit: { roomNumber: string; propertyId: string }
  payment?: { id: string; status: string } | null
}

const statusKind: Record<string, 'paid' | 'pending' | 'overdue' | 'info'> = {
  PAID: 'paid',
  PENDING: 'pending',
  SLIP_UPLOADED: 'info',
  OVERDUE: 'overdue',
  CANCELLED: 'pending',
}
const statusText: Record<string, string> = {
  PAID: 'ชำระแล้ว',
  PENDING: 'รอชำระ',
  SLIP_UPLOADED: 'รอตรวจสลิป',
  OVERDUE: 'ค้างชำระ',
  CANCELLED: 'ยกเลิก',
}

export default function BillingOverview() {
  const nav = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const now = new Date()

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data))
  }, [])

  const collected = invoices.filter((i) => i.status === 'PAID').reduce((a, i) => a + Number(i.total), 0)
  const pending = invoices.filter((i) => ['PENDING', 'SLIP_UPLOADED'].includes(i.status)).reduce((a, i) => a + Number(i.total), 0)
  const overdue = invoices.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + Number(i.total), 0)

  function openInvoice(inv: Invoice) {
    if (inv.payment && (inv.status === 'SLIP_UPLOADED' || inv.payment.status === 'UNDER_REVIEW')) {
      nav(`/admin/slip/${inv.payment.id}`)
    } else if (inv.status === 'PAID' && inv.payment) {
      nav(`/admin/receipt/${inv.payment.id}`)
    }
  }

  return (
    <div className="pb-20">
      <TopBar title="ภาพรวมบิล" back={false} />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="รับแล้ว" value={baht(collected)} kind="paid" />
          <Metric label="รอรับ" value={baht(pending)} kind="pending" />
          <Metric label="ค้างชำระ" value={baht(overdue)} kind="overdue" />
        </div>

        <div className="space-y-2">
          {invoices.map((inv) => (
            <Card key={inv.id} className="flex items-center justify-between py-3" onClick={() => openInvoice(inv)}>
              <div>
                <div className="font-medium">ห้อง {inv.unit.roomNumber}</div>
                <div className="text-xs text-gray-400">{thaiMonth(inv.month)} {inv.year} · {baht(inv.total)}</div>
              </div>
              <Badge kind={statusKind[inv.status] || 'pending'}>{statusText[inv.status] || inv.status}</Badge>
            </Card>
          ))}
          {invoices.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีใบแจ้งหนี้</p>}
        </div>

        <button onClick={() => nav('/admin/invoice-builder')} className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-4 text-gray-500 font-medium">
          + สร้าง/ส่งใบแจ้งหนี้
        </button>
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}

function Metric({ label, value, kind }: { label: string; value: string; kind: 'paid' | 'pending' | 'overdue' }) {
  const color = kind === 'paid' ? 'text-line' : kind === 'overdue' ? 'text-danger' : 'text-amber'
  return (
    <Card className="text-center py-3">
      <div className={`font-bold text-sm ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </Card>
  )
}
