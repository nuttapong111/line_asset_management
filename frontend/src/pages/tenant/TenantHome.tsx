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

  return (
    <div className="pb-20">
      <div className="bg-line text-white px-5 pt-7 pb-8 rounded-b-[28px]">
        <p className="text-white/75 text-sm">สวัสดี</p>
        <h1 className="text-2xl font-bold mt-0.5">{user?.name || 'ผู้เช่า'}</h1>
        {room && <p className="text-white/80 text-sm mt-1">ห้อง {room}</p>}
      </div>

      <div className="p-4 space-y-3">
        {unpaid ? (
          <Card>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-500">
                {thaiMonth(unpaid.month)} {unpaid.year}
              </span>
              <Badge
                kind={
                  unpaid.status === 'OVERDUE'
                    ? 'overdue'
                    : unpaid.status === 'SLIP_UPLOADED'
                      ? 'info'
                      : 'pending'
                }
              >
                {unpaid.status === 'OVERDUE'
                  ? 'ค้างชำระ'
                  : unpaid.status === 'SLIP_UPLOADED'
                    ? 'รอตรวจสลิป'
                    : 'รอชำระ'}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-line my-2">{baht(unpaid.total)}</div>
            <p className="text-xs text-gray-400 mb-3">กำหนดชำระ {thaiDate(unpaid.dueDate)}</p>
            {unpaid.status !== 'SLIP_UPLOADED' && (
              <Button onClick={() => nav(`/payment/${unpaid.id}`)}>ชำระเงิน</Button>
            )}
          </Card>
        ) : (
          <Card className="text-center py-8">
            <p className="text-gray-600 font-medium">ไม่มียอดค้างชำระ</p>
            <p className="text-xs text-gray-400 mt-1">ใช้เมนูด้านล่างเพื่อดูเอกสารหรือชุมชน</p>
          </Card>
        )}

        {invoices.length > 0 && (
          <Card className="!p-0 overflow-hidden">
            <div className="px-4 py-3 font-semibold text-sm">ประวัติล่าสุด</div>
            {invoices.slice(0, 4).map((i) => (
              <button
                key={i.id}
                className="w-full flex justify-between px-4 py-3 border-t border-gray-50 text-sm"
                onClick={() => nav(`/tenant/invoice/${i.id}`)}
              >
                <span className="text-gray-500">
                  {thaiMonth(i.month)} {i.year}
                </span>
                <span>{baht(i.total)}</span>
              </button>
            ))}
          </Card>
        )}
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
