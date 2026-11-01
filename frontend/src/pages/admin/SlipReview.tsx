import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { bahtExact, cls, thaiDateTime } from '../../lib/utils'

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
  bundleId?: string | null
  bundleTotal?: number | null
  bundleInvoices?: { id: string; type: string; total: number; month: number; year: number }[] | null
  tenant: { name: string }
  invoice: { total: string; month?: number; year?: number; type?: string; unit: { roomNumber: string } }
  expectedPromptpay?: string | null
  expectedBankAccount?: string | null
}

const REASONS = ['ยอดไม่ตรง', 'บัญชีไม่ตรง', 'สลิปไม่ชัด', 'วันที่ไม่ตรง']

export default function SlipReview() {
  const { paymentId } = useParams()
  const nav = useNavigate()
  const [payment, setPayment] = useState<Payment>()
  const [slipPreview, setSlipPreview] = useState<string>()
  const [zoom, setZoom] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get(`/payments/${paymentId}`).then((r) => setPayment(r.data))

  async function approve(acceptShortfall = false) {
    setBusy(true)
    try {
      const { data } = await api.post(`/payments/${paymentId}/approve`, { acceptShortfall })
      nav(`/admin/receipt/${data.payment?.id || paymentId}`, { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error || 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function reject() {
    const rejectReason = note.trim() || reason
    if (!rejectReason) return
    setBusy(true)
    try {
      await api.post(`/payments/${paymentId}/reject`, { rejectReason })
      nav('/admin/billing', { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      alert(err.response?.data?.error || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (!payment) {
    return (
      <div>
        <TopBar title="ตรวจสลิป" />
        <div className="p-4"><div className="h-40 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  const billTotal = Number(payment.bundleTotal || payment.invoice.total)
  const slipAmt = payment.ocrAmount != null && payment.ocrAmount !== '' ? Number(payment.ocrAmount) : null
  const shortfall = slipAmt != null ? Math.round((billTotal - slipAmt) * 100) / 100 : 0
  const showShortfall = slipAmt != null && shortfall > 0.5
  const account = payment.expectedPromptpay || payment.expectedBankAccount
  const statusLabel = payment.status === 'APPROVED' ? 'อนุมัติแล้ว' : payment.status === 'REJECTED' ? 'ปฏิเสธ' : 'รอตรวจ'

  return (
    <div className="pb-28">
      <TopBar title="ตรวจสลิป" right={<span className="text-sm font-semibold text-muted">{statusLabel}</span>} />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex flex-col min-w-0">
            <strong className="text-[17px] truncate">{payment.invoice.unit.roomNumber} · {payment.tenant.name}</strong>
            <span className="text-[13px] text-muted">
              {payment.bundleInvoices && payment.bundleInvoices.length > 1
                ? `${payment.bundleInvoices.length} บิล · `
                : ''}
              ส่ง {thaiDateTime(payment.slipUploadedAt)}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-warn-bg text-warn-fg text-[13px] font-semibold shrink-0">{statusLabel}</span>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="w-[132px] h-[220px] shrink-0 rounded-[14px] bg-white border border-line-soft overflow-hidden flex flex-col"
            onClick={() => slipPreview && setZoom(true)}
            aria-label="รูปสลิปการโอน"
          >
            {slipPreview ? (
              <img src={slipPreview} alt="สลิป" className="w-full h-full object-cover" />
            ) : (
              <span className="m-auto text-xs text-muted px-2 text-center">{payment.hasSlip ? 'กำลังโหลดรูปสลิป' : 'ไม่มีรูปสลิป'}</span>
            )}
          </button>
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-muted">ผลอ่านสลิป (คำแนะนำ)</span>
              {payment.hasSlip && payment.status !== 'APPROVED' && (
                <button type="button" className="text-xs font-bold text-primary" onClick={rerunOcr} disabled={busy}>ตรวจใหม่</button>
              )}
            </div>
            <Hint
              ok={payment.ocrMatched === true}
              bad={payment.ocrMatched === false}
              title={payment.ocrMatched === true ? 'ยอดตรง' : payment.ocrMatched === false ? 'ยอดไม่ตรง' : 'ยังไม่อ่านยอด'}
              line={slipAmt != null ? `สลิป ${bahtExact(slipAmt)}` : 'ยังไม่พบยอดในสลิป'}
              sub={`บิล ${bahtExact(billTotal)}${showShortfall ? ` · ขาด ${bahtExact(shortfall)}` : ''}`}
            />
            <Hint
              ok={payment.ocrAccountMatched === true}
              bad={payment.ocrAccountMatched === false}
              title={payment.ocrAccountMatched === true ? 'บัญชีปลายทางตรง' : payment.ocrAccountMatched === false ? 'บัญชีไม่ตรง' : 'ยังไม่เทียบบัญชี'}
              line={payment.ocrParsedAccount || account || '-'}
            />
            <Hint
              ok={Boolean(payment.ocrDate)}
              bad={false}
              title="วันที่โอน"
              line={payment.ocrDate ? thaiDateTime(payment.ocrDate) : 'ไม่พบวันที่'}
            />
            {payment.ocrNote && <p className="text-xs text-muted">{payment.ocrNote}</p>}
          </div>
        </div>

        {payment.status !== 'APPROVED' && (
          <section className="bg-white rounded-card p-3.5 flex flex-col gap-2.5">
            <strong className="text-sm">ถ้าปฏิเสธ เลือกเหตุผลด่วน</strong>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={reason === r}
                  className={cls(
                    'h-9 px-3 rounded-full text-sm border-[1.5px]',
                    reason === r ? 'border-danger bg-danger-bg text-danger font-semibold' : 'border-line-soft bg-white text-ink'
                  )}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
              ข้อความถึงผู้เช่า
              <input
                className="h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-sm font-normal text-ink"
                value={note}
                placeholder={reason}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </section>
        )}

        {showShortfall && payment.status !== 'APPROVED' && (
          <button type="button" className="h-11 rounded-button border-[1.5px] border-primary text-primary text-sm font-bold disabled:opacity-50" onClick={() => approve(true)} disabled={busy}>
            รับสลิป และบันทึกส่วนต่างเป็นยอดค้าง
          </button>
        )}
      </div>

      {payment.status !== 'APPROVED' && (
        <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-[1fr_1.6fr] gap-2.5">
          <button type="button" className="h-[52px] rounded-cta bg-danger-bg text-danger text-base font-bold disabled:opacity-50" onClick={reject} disabled={busy}>
            ปฏิเสธ
          </button>
          <button type="button" className="h-[52px] rounded-cta bg-primary text-white text-base font-bold disabled:opacity-50" onClick={() => approve(false)} disabled={busy}>
            {busy ? 'กำลังดำเนินการ...' : 'อนุมัติ + ออกใบเสร็จ'}
          </button>
        </div>
      )}

      {zoom && slipPreview && (
        <button type="button" className="fixed inset-0 z-40 bg-ink/80 flex items-center justify-center p-4" onClick={() => setZoom(false)} aria-label="ปิดรูป">
          <img src={slipPreview} alt="สลิปขยาย" className="max-h-[90vh] max-w-full rounded-card" />
        </button>
      )}
    </div>
  )
}

function Hint({ ok, bad, title, line, sub }: { ok: boolean; bad: boolean; title: string; line: string; sub?: string }) {
  const box = ok ? 'bg-ok-bg' : bad ? 'bg-danger-bg' : 'bg-warn-bg'
  const fg = ok ? 'text-ok-fg' : bad ? 'text-danger' : 'text-warn-fg'
  return (
    <div className={cls('rounded-button px-3 py-2.5 flex flex-col gap-0.5', box)}>
      <span className={cls('text-xs font-bold', fg)}>{title}</span>
      <span className="text-sm">{line}</span>
      {sub && <span className="text-[13px] text-muted">{sub}</span>}
    </div>
  )
}
