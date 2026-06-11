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
  unit: { roomNumber: string }
  payment?: { id: string; status: string; receiptUrl?: string } | null
}

const statusText: Record<string, string> = {
  PAID: 'ชำระแล้ว', PENDING: 'รอชำระ', SLIP_UPLOADED: 'รอตรวจสลิป', OVERDUE: 'ค้างชำระ', CANCELLED: 'ยกเลิก',
}
const statusKind: Record<string, 'paid' | 'pending' | 'overdue' | 'info'> = {
  PAID: 'paid', PENDING: 'pending', SLIP_UPLOADED: 'info', OVERDUE: 'overdue', CANCELLED: 'pending',
}

export default function PaymentHistory() {
  const nav = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data))
  }, [])

  return (
    <div className="pb-20">
      <TopBar title="ประวัติการชำระเงิน" back={false} />
      <div className="p-4 space-y-2">
        {invoices.map((i) => (
          <Card key={i.id} className="flex items-center justify-between" onClick={() => {
            if (i.status === 'PAID' && i.payment?.receiptUrl) window.open(i.payment.receiptUrl, '_blank')
            else nav(`/tenant/invoice/${i.id}`)
          }}>
            <div>
              <div className="font-medium">{thaiMonth(i.month)} {i.year}</div>
              <div className="text-xs text-gray-400">ห้อง {i.unit.roomNumber} · {baht(i.total)}</div>
            </div>
            <Badge kind={statusKind[i.status] || 'pending'}>{statusText[i.status] || i.status}</Badge>
          </Card>
        ))}
        {invoices.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีประวัติ</p>}
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
