import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { openPdfViewer } from '../../lib/pdfNav'
import { Button, Card, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDate } from '../../lib/utils'

interface Payment {
  id: string
  receiptNo?: string
  hasReceipt?: boolean
  approvedAt?: string
  tenant: { name: string }
  invoice: {
    total: string
    rentAmount: string
    electricAmount: string
    waterAmount: string
    commonFee: string
    lateFee: string
    unit: { roomNumber: string }
  }
}

export default function ReceiptView() {
  const { paymentId } = useParams()
  const nav = useNavigate()
  const [payment, setPayment] = useState<Payment>()

  useEffect(() => {
    api.get(`/payments/${paymentId}`).then((r) => setPayment(r.data))
  }, [paymentId])

  if (!payment) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const inv = payment.invoice
  const items = [
    { label: 'ค่าเช่า', amount: inv.rentAmount },
    { label: 'ค่าไฟฟ้า', amount: inv.electricAmount },
    { label: 'ค่าน้ำ', amount: inv.waterAmount },
    { label: 'ค่าส่วนกลาง', amount: inv.commonFee },
  ]
  if (Number(inv.lateFee) > 0) items.push({ label: 'ค่าปรับ', amount: inv.lateFee })

  return (
    <div>
      <TopBar title="ใบเสร็จรับเงิน" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-center mb-3">
            <div>
              <div className="font-semibold">{payment.receiptNo || '-'}</div>
              <div className="text-xs text-gray-400">{thaiDate(payment.approvedAt)}</div>
            </div>
            <Badge kind="paid">ชำระครบถ้วนแล้ว ✓</Badge>
          </div>
          <div className="text-sm text-gray-600 space-y-1 mb-3">
            <div className="flex justify-between"><span className="text-gray-400">ผู้เช่า</span><span>{payment.tenant.name}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">ห้อง</span><span>{inv.unit.roomNumber}</span></div>
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
            {items.map((it) => (
              <div key={it.label} className="flex justify-between">
                <span className="text-gray-500">{it.label}</span>
                <span>{baht(it.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-line border-t border-gray-100 pt-2 mt-1">
              <span>รวมทั้งสิ้น</span><span>{baht(inv.total)}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={() => openPdfViewer(nav, `payments/${paymentId}/receipt/pdf`, { title: 'ใบเสร็จรับเงิน' })}
            disabled={!payment.hasReceipt}
          >
            ดู / ดาวน์โหลด PDF
          </Button>
          <Button variant="secondary" onClick={() => openPdfViewer(nav, `payments/${paymentId}/receipt/pdf`, { title: 'ใบเสร็จรับเงิน', print: true })}>
            ปริ้น PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
