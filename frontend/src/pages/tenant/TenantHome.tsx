import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge, Button } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../hooks/useAuth'
import { baht, thaiDate, thaiMonth } from '../../lib/utils'

interface Invoice {
  id: string
  month: number
  year: number
  total: string
  status: string
  dueDate: string
  unit: { roomNumber: string }
}

export default function TenantHome() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])

  useEffect(() => {
    api.get('/invoices').then((r) => setInvoices(r.data))
  }, [])

  const unpaid = invoices.find((i) => ['PENDING', 'OVERDUE', 'SLIP_UPLOADED'].includes(i.status))
  const room = invoices[0]?.unit.roomNumber

  const quick = [
    { label: 'ใบแจ้งหนี้', path: unpaid ? `/tenant/invoice/${unpaid.id}` : '/tenant/history', icon: '🧾' },
    { label: 'ใบเสร็จ', path: '/tenant/history', icon: '✅' },
    { label: 'แจ้งซ่อม', path: '/tenant/maintenance', icon: '🔧' },
    { label: 'สัญญา', path: '/contract', icon: '📄' },
  ]

  return (
    <div className="pb-20">
      <div className="bg-line text-white px-4 pt-6 pb-10 rounded-b-3xl">
        <p className="text-white/80 text-sm">สวัสดี</p>
        <h1 className="text-2xl font-bold">{user?.name || 'ผู้เช่า'}</h1>
        {room && <p className="text-white/80 text-sm mt-1">ห้อง {room}</p>}
      </div>

      <div className="p-4 -mt-6 space-y-4">
        {unpaid ? (
          <Card>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-500">ใบแจ้งหนี้ {thaiMonth(unpaid.month)} {unpaid.year}</span>
              <Badge kind={unpaid.status === 'OVERDUE' ? 'overdue' : unpaid.status === 'SLIP_UPLOADED' ? 'info' : 'pending'}>
                {unpaid.status === 'OVERDUE' ? 'ค้างชำระ' : unpaid.status === 'SLIP_UPLOADED' ? 'รอตรวจสลิป' : 'รอชำระ'}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-line my-2">{baht(unpaid.total)}</div>
            <p className="text-xs text-gray-400 mb-3">กำหนดชำระ {thaiDate(unpaid.dueDate)}</p>
            {unpaid.status !== 'SLIP_UPLOADED' && (
              <Button onClick={() => nav(`/payment/${unpaid.id}`)}>ชำระเงิน</Button>
            )}
          </Card>
        ) : (
          <Card className="text-center py-6">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-gray-600">ไม่มียอดค้างชำระ</p>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2">
          {quick.map((q) => (
            <button key={q.label} onClick={() => nav(q.path)} className="bg-white rounded-2xl py-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1">
              <span className="text-2xl">{q.icon}</span>
              <span className="text-[11px] text-gray-600">{q.label}</span>
            </button>
          ))}
        </div>

        <Card>
          <h4 className="font-semibold mb-2">ประวัติล่าสุด</h4>
          {invoices.slice(0, 3).map((i) => (
            <div key={i.id} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm" onClick={() => nav(`/tenant/invoice/${i.id}`)}>
              <span className="text-gray-500">{thaiMonth(i.month)} {i.year}</span>
              <span>{baht(i.total)}</span>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-gray-400 text-sm">ยังไม่มีรายการ</p>}
        </Card>
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
