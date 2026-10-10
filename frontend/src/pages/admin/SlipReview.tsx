import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge, Textarea } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDateTime } from '../../lib/utils'

interface Payment {
  id: string
  hasSlip?: boolean
  slipUploadedAt?: string
  ocrAmount?: string
  ocrDate?: string
  ocrMatched?: boolean | null
  ocrAccountMatched?: boolean | null
  ocrParsedAccount?: string | null
  ocrNote?: string | null
  status: string
  tenant: { name: string }
  invoice: { total: string; unit: { roomNumber: string } }
  expectedPromptpay?: string | null
  expectedBankAccount?: string | null
}

function MatchBadge({ value, naLabel = 'ไม่ตรวจ' }: { value: boolean | null | undefined; naLabel?: string }) {
  if (value === true) return <Badge kind="paid">ตรง</Badge>
  if (value === false) return <Badge kind="overdue">ไม่ตรง</Badge>
  return <Badge kind="gray">{naLabel}</Badge>
}

export default function SlipReview() {
  const { paymentId } = useParams()
  const nav = useNavigate()
  const [payment, setPayment] = useState<Payment>()
  const [slipPreview, setSlipPreview] = useState<string>()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get(`/payments/${paymentId}`).then((r) => setPayment(r.data))

  useEffect(() => {
    load()
  }, [paymentId])

  useEffect(() => {
    if (!payment?.hasSlip || !paymentId) return
    let url: string | undefined
    api
      .get(`/payments/${paymentId}/slip`, { responseType: 'blob' })
      .then(({ data }) => {
        url = URL.createObjectURL(data)
        setSlipPreview(url)
      })
      .catch(() => setSlipPreview(undefined))
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [paymentId, payment?.hasSlip])

  async function rerunOcr() {
    setBusy(true)
    try {
      await api.post(`/payments/${paymentId}/reocr`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    setBusy(true)
    try {
      const { data } = await api.post(`/payments/${paymentId}/approve`)
      nav(`/admin/receipt/${data.payment.id}`, { replace: true })
    } catch (e: any) {
      alert(e.response?.data?.error || 'อนุมัติไม่สำเร็จ')
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
    } catch (e: any) {
      alert(e.response?.data?.error || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (!payment) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  const amountOk = payment.ocrMatched === true
  const accountOk = payment.ocrAccountMatched
  const overallOk = amountOk && accountOk !== false
  const overallWarn = payment.ocrMatched === false || payment.ocrAccountMatched === false

  return (
    <div>
      <TopBar title="ตรวจสอบสลิป" />
      <div className="p-4 space-y-4">
        <Card className="flex justify-between items-center">
          <div>
            <div className="font-semibold">{payment.tenant.name}</div>
            <div className="text-xs text-gray-400">
              ห้อง {payment.invoice.unit.roomNumber} · {thaiDateTime(payment.slipUploadedAt)}
            </div>
          </div>
          <Badge kind={payment.status === 'APPROVED' ? 'paid' : 'info'}>{payment.status}</Badge>
        </Card>

        {payment.hasSlip && (
          <Card>
            {slipPreview ? (
              <img src={slipPreview} alt="slip" className="w-full rounded-xl" />
            ) : (
              <p className="text-center text-gray-400 py-8">กำลังโหลดรูปสลิป...</p>
            )}
          </Card>
        )}

        <Card
          className={
            overallOk ? 'bg-line-light border-line' : overallWarn ? 'bg-red-50 border-red-100' : ''
          }
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold">ผลตรวจสลิป (OCR แนะนำ)</h4>
            {payment.hasSlip && payment.status !== 'APPROVED' && (
              <button type="button" className="text-xs text-line" onClick={rerunOcr} disabled={busy}>
                {busy ? 'กำลังตรวจ...' : 'ตรวจใหม่'}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">ระบบอ่านรูปบนเซิร์ฟเวอร์ของคุณเอง — ไม่ส่งสลิปออกนอกระบบ · แอดมินเป็นผู้อนุมัติสุดท้าย</p>

          <div className="text-sm space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500">ยอดที่ต้องชำระ</span>
              <span>{baht(payment.invoice.total)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500">ยอดในสลิป</span>
              <span className="flex items-center gap-2">
                {payment.ocrAmount ? baht(payment.ocrAmount) : '-'}
                <MatchBadge value={payment.ocrMatched} naLabel="ยังไม่อ่าน" />
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500">บัญชีปลายทางที่ตั้งไว้</span>
              <span className="text-right text-xs">
                {payment.expectedPromptpay || '-'}
                {payment.expectedBankAccount ? (
                  <span className="block text-gray-400">บ/ช {payment.expectedBankAccount}</span>
                ) : null}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-gray-500">บัญชีที่อ่านจากสลิป</span>
              <span className="flex items-center gap-2">
                {payment.ocrParsedAccount || '-'}
                <MatchBadge
                  value={payment.ocrAccountMatched}
                  naLabel={!payment.expectedPromptpay && !payment.expectedBankAccount ? 'ไม่มีค่าเทียบ' : 'ไม่พบ'}
                />
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100">
              <span className="text-gray-500 font-medium">สรุปแนะนำ</span>
              {overallOk ? (
                <Badge kind="paid">น่าจะตรง</Badge>
              ) : overallWarn ? (
                <Badge kind="overdue">ควรตรวจด้วยตา</Badge>
              ) : (
                <Badge kind="gray">ยังไม่ครบ</Badge>
              )}
            </div>
          </div>
          {payment.ocrNote && <p className="text-xs text-gray-500 mt-3">{payment.ocrNote}</p>}
        </Card>

        {showReject && (
          <Card>
            <Textarea label="เหตุผลที่ปฏิเสธ" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Card>
        )}

        {payment.status !== 'APPROVED' && (
          <div className="grid grid-cols-2 gap-3">
            {showReject ? (
              <Button variant="danger" onClick={reject} disabled={busy || !reason}>
                ยืนยันปฏิเสธ
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setShowReject(true)}>
                ปฏิเสธ
              </Button>
            )}
            <Button onClick={approve} disabled={busy}>
              {busy ? 'กำลังดำเนินการ...' : 'อนุมัติ'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
