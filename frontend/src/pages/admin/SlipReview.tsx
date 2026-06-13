import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge, Textarea } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDateTime } from '../../lib/utils'

interface Payment {
  id: string
  slipUrl?: string
  slipUploadedAt?: string
  ocrAmount?: string
  ocrDate?: string
  ocrMatched?: boolean
  status: string
  tenant: { name: string }
  invoice: { total: string; unit: { roomNumber: string } }
}

export default function SlipReview() {
  const { paymentId } = useParams()
  const nav = useNavigate()
  const [payment, setPayment] = useState<Payment>()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get(`/payments/${paymentId}`).then((r) => setPayment(r.data))
  }, [paymentId])

  async function approve() {
    setBusy(true)
    try {
      const { data } = await api.post(`/payments/${paymentId}/approve`)
      nav(`/admin/receipt/${data.payment.id}`, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!reason) return
    setBusy(true)
    try {
      await api.post(`/payments/${paymentId}/reject`, { rejectReason: reason })
      nav('/admin/billing', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  if (!payment) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div>
      <TopBar title="ตรวจสอบสลิป" />
      <div className="p-4 space-y-4">
        <Card className="flex justify-between items-center">
          <div>
            <div className="font-semibold">{payment.tenant.name}</div>
            <div className="text-xs text-gray-400">ห้อง {payment.invoice.unit.roomNumber} · {thaiDateTime(payment.slipUploadedAt)}</div>
          </div>
          <Badge kind={payment.status === 'APPROVED' ? 'paid' : 'info'}>{payment.status}</Badge>
        </Card>

        {payment.slipUrl && (
          <Card>
            <img src={payment.slipUrl} alt="slip" className="w-full rounded-xl" />
          </Card>
        )}

        <Card className={payment.ocrMatched ? 'bg-line-light border-line' : ''}>
          <h4 className="font-semibold mb-2">ผลตรวจสลิป (OCR)</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">ยอดที่ต้องชำระ</span><span>{baht(payment.invoice.total)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ยอดในสลิป</span><span>{payment.ocrAmount ? baht(payment.ocrAmount) : '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">ตรงกัน</span><span>{payment.ocrMatched ? '✓ ตรงกัน' : '✗ ไม่ตรง'}</span></div>
          </div>
          {!payment.ocrMatched && !payment.ocrAmount && (
            <p className="text-xs text-gray-400 mt-2">
              ระบบตรวจสลิปอัตโนมัติยังไม่เปิดใช้งาน กรุณาตรวจยอดกับรูปสลิปด้วยตนเอง
            </p>
          )}
        </Card>

        {showReject && (
          <Card>
            <Textarea label="เหตุผลที่ปฏิเสธ" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Card>
        )}

        {payment.status !== 'APPROVED' && (
          <div className="grid grid-cols-2 gap-3">
            {showReject ? (
              <Button variant="danger" onClick={reject} disabled={busy || !reason}>ยืนยันปฏิเสธ</Button>
            ) : (
              <Button variant="danger" onClick={() => setShowReject(true)}>ปฏิเสธ</Button>
            )}
            <Button onClick={approve} disabled={busy}>{busy ? 'กำลังดำเนินการ...' : 'อนุมัติ'}</Button>
          </div>
        )}
      </div>
    </div>
  )
}
