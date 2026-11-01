import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { AuthImage } from '../../components/AuthImage'
import { bahtExact, thaiMonth } from '../../lib/utils'

interface Bill {
  id: string
  type?: string
  month: number
  year: number
  total: string | number
  dueDate: string
  status: string
}

interface QrInfo {
  payload?: string | null
  amount: number
  promptpayNumber?: string | null
  bankAccount?: string | null
  bankName?: string | null
  hasPaymentQr?: boolean
}

const TYPE_TH: Record<string, string> = { RENT: 'ค่าเช่า', UTILITY: 'ค่าน้ำไฟ', SHORTFALL: 'ส่วนต่าง' }

const STEPS = ['สแกนจ่าย', 'แนบสลิป', 'รอตรวจ']

export default function PayFlow({ invoiceId }: { invoiceId?: string }) {
  const nav = useNavigate()
  const [bills, setBills] = useState<Bill[]>([])
  const [loaded, setLoaded] = useState(false)
  const [bundleId, setBundleId] = useState<string>()
  const [qr, setQr] = useState<QrInfo>()
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  useEffect(() => {
    api
      .get('/invoices')
      .then((r) => {
        const unpaid = (r.data as Bill[]).filter((i) =>
          invoiceId ? i.id === invoiceId : ['PENDING', 'OVERDUE'].includes(i.status)
        )
        setBills(unpaid)
      })
      .catch(() => setError('โหลดบิลไม่สำเร็จ'))
      .finally(() => setLoaded(true))
  }, [invoiceId])

  const total = bills.reduce((s, b) => s + Number(b.total), 0)
  const summary = bills.map((b) => `${TYPE_TH[b.type || 'RENT']} ${thaiMonth(b.month)}`).join(' + ')

  useEffect(() => {
    if (!loaded || bills.length === 0 || started.current) return
    started.current = true
    void loadQr(bills)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, bills])

  async function loadQr(list: Bill[]) {
    setError(undefined)
    setBusy(true)
    try {
      if (list.length > 1) {
        const { data } = await api.post('/payments/bundle', { invoiceIds: list.map((b) => b.id) })
        setBundleId(data.id)
        setQr({
          payload: data.payload,
          amount: data.total,
          promptpayNumber: data.promptpayNumber,
          bankAccount: data.bankAccount,
          bankName: data.bankName,
          hasPaymentQr: data.hasPaymentQr,
        })
      } else if (list[0]) {
        const { data } = await api.get(`/payments/${list[0].id}/qr`)
        setQr(data)
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'สร้าง QR ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!file) return
    setBusy(true)
    setError(undefined)
    const fd = new FormData()
    fd.append('file', file)
    const state = {
      total: qr?.amount ?? total,
      billsLabel: summary,
      sentAt: new Date().toISOString(),
    }
    try {
      if (bundleId) {
        const { data } = await api.post(`/payments/bundle/${bundleId}/slip`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        nav(`/payment/${bills[0]?.id || 'done'}/success`, { replace: true, state: { ...state, paymentId: data.paymentId } })
      } else if (bills[0]) {
        await api.post(`/payments/${bills[0].id}/slip`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        nav(`/payment/${bills[0].id}/success`, { replace: true, state })
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'อัปโหลดไม่สำเร็จ')
      setBusy(false)
    }
  }

  async function copyAccount() {
    const value = qr?.bankAccount || qr?.promptpayNumber
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function saveQr() {
    const svg = document.getElementById('pay-qr')
    if (svg) {
      const xml = new XMLSerializer().serializeToString(svg)
      const blob = new Blob([xml], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'promptpay-qr.svg'
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    if (qr?.hasPaymentQr && bills[0]) {
      const { data } = await api.get(`/payments/${bills[0].id}/payment-qr`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'payment-qr.jpg'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const accountLine = [qr?.bankName || (qr?.promptpayNumber ? 'PromptPay' : ''), qr?.bankAccount || qr?.promptpayNumber]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen flex flex-col bg-canvas pb-28">
      <TopBar title="ชำระเงิน" />
      <div className="px-4 pt-4 flex flex-col gap-3.5">
        <ol aria-label="ขั้นตอน" className="grid grid-cols-3 gap-1.5 list-none m-0 p-0">
          {STEPS.map((label, i) => {
            const active = i < 2
            return (
              <li key={label} className="flex flex-col gap-1.5">
                <span className={`h-1 rounded ${active ? 'bg-primary' : 'bg-[#DCE3DF]'}`} />
                <span className={`text-xs ${active ? 'font-bold text-primary' : 'font-semibold text-muted'}`}>
                  {i + 1} {label}
                </span>
              </li>
            )
          })}
        </ol>

        {error && <p className="text-sm text-danger bg-danger-bg rounded-card px-3 py-2">{error}</p>}

        {loaded && bills.length === 0 && <p className="text-center text-muted py-10">ไม่มียอดค้างชำระ</p>}

        {!loaded && <div className="h-80 rounded-hero bg-surface-2" />}

        {bills.length > 0 && (
          <section className="bg-white rounded-hero p-[18px] flex flex-col items-center gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm text-muted">{summary || 'ยอดที่ต้องชำระ'}</span>
              <strong className="pf-amount text-[34px]">{bahtExact(qr?.amount ?? total)}</strong>
            </div>
            <div className="p-3 rounded-card border border-[#DCE3DF] flex flex-col items-center gap-2">
              <span className="text-xs font-extrabold tracking-wider text-info">PromptPay</span>
              {qr?.payload ? (
                <QRCodeSVG id="pay-qr" value={qr.payload} size={168} />
              ) : qr?.hasPaymentQr && bills[0] ? (
                <AuthImage
                  path={`/payments/${bills[0].id}/payment-qr`}
                  alt="QR รับเงิน"
                  className="w-[168px] h-[168px] object-contain"
                />
              ) : (
                <div className="w-[168px] h-[168px] bg-surface-2 rounded-xl flex items-center justify-center text-sm text-muted text-center px-3">
                  {busy ? 'กำลังสร้าง QR' : 'อาคารนี้ยังไม่ได้ตั้งเลขพร้อมเพย์'}
                </div>
              )}
              {accountLine && <span className="text-[13px] text-muted text-center">{accountLine}</span>}
            </div>
            <div className="w-full grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={saveQr}
                disabled={!qr?.payload && !qr?.hasPaymentQr}
                className="h-11 rounded-button border-[1.5px] border-primary bg-white text-primary text-[15px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                บันทึก QR
              </button>
              <button
                type="button"
                onClick={copyAccount}
                disabled={!qr?.bankAccount && !qr?.promptpayNumber}
                className="h-11 rounded-button border-[1.5px] border-[#DCE3DF] bg-white text-ink text-[15px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}
              </button>
            </div>
          </section>
        )}

        {bills.length > 0 && (
          <section className="bg-white rounded-hero p-4 flex flex-col gap-2.5">
            <strong className="text-[15px]">แนบสลิปการโอน</strong>
            {file ? (
              <div className="flex gap-3 items-center border-[1.5px] border-primary bg-primary-soft rounded-cta p-2.5">
                {preview ? (
                  <img src={preview} alt="สลิป" className="w-[52px] h-[72px] rounded-lg object-cover bg-surface-2" />
                ) : (
                  <div className="w-[52px] h-[72px] rounded-lg bg-surface-2" />
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <strong className="text-sm truncate">{file.name}</strong>
                  <span className="text-[13px] text-muted">พร้อมส่งให้เจ้าของตรวจ</span>
                </div>
                <button type="button" className="h-9 px-3 text-primary text-sm font-bold" onClick={() => fileRef.current?.click()}>
                  เปลี่ยน
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-[72px] border-[1.5px] border-dashed border-placeholder rounded-cta text-primary font-bold text-[15px]"
              >
                แตะเพื่อแนบสลิป
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setFile(f)
                setPreview(URL.createObjectURL(f))
              }}
            />
          </section>
        )}
      </div>

      {bills.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 max-w-liff mx-auto bg-white border-t border-[#EEF1EF] px-4 pt-3 pb-6">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !file}
            className="w-full h-[52px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50"
          >
            {busy ? 'กำลังส่ง...' : 'ส่งสลิปให้เจ้าของตรวจ'}
          </button>
        </div>
      )}
    </div>
  )
}
