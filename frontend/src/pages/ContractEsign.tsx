import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/axios'
import { openPdfViewer } from '../lib/pdfNav'
import { TopBar } from '../components/layout/TopBar'
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad'
import { useAuthStore } from '../store/authStore'
import { thaiDate } from '../lib/utils'

interface ContractEsignInfo {
  id: string
  status: string
  startDate?: string
  endDate?: string
  rentAmount?: string
  deposit?: string
  signedAt?: string | null
  landlordSignedAt?: string | null
  tenantSignedAt?: string | null
  signedDocumentUrl?: string | null
  tenant: { name: string }
  unit: { roomNumber: string; property: { name: string } }
}

function money(n: string | number | undefined) {
  if (n == null) return '—'
  const v = Number(n)
  const digits = Number.isInteger(v) ? 0 : 2
  return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default function ContractEsign() {
  const { id } = useParams()
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const padRef = useRef<SignaturePadHandle | null>(null)
  const [contract, setContract] = useState<ContractEsignInfo>()
  const [hasInk, setHasInk] = useState(false)
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const load = () => api.get(`/contracts/${id}`).then((r) => setContract(r.data))
  useEffect(() => {
    load().catch(() => setError('ไม่พบสัญญา'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!contract && !error) return <div className="p-6"><div className="h-40 rounded-card bg-surface-2" /></div>
  if (error && !contract) {
    return (
      <div>
        <TopBar title="เซ็นสัญญา" />
        <p className="p-8 text-center text-muted">{error}</p>
      </div>
    )
  }
  if (!contract) return null

  const isTenant = role === 'TENANT'
  const alreadySigned = isTenant ? Boolean(contract.tenantSignedAt) : Boolean(contract.landlordSignedAt)
  const backPath = isTenant ? (id ? `/contract/${id}` : '/contract') : `/admin/contract/${id}`

  async function submit() {
    if (!consent) {
      setError('กรุณายอมรับเงื่อนไขในสัญญาก่อนยืนยัน')
      return
    }
    const dataUrl = padRef.current?.getDataUrl()
    if (!dataUrl) {
      setError('กรุณาเซ็นในช่องก่อนบันทึก')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const { data } = await api.post(`/contracts/${id}/esign`, { signaturePng: dataUrl })
      const invoiceId = data?.esign?.openingInvoiceId as string | undefined
      padRef.current?.clear()
      setHasInk(false)
      if (isTenant && invoiceId) {
        nav(`/payment/${invoiceId}`, { replace: true })
        return
      }
      nav(backPath, { replace: true })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'บันทึกลายเซ็นไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas pb-28">
      <TopBar title={isTenant ? 'เซ็นสัญญา' : 'เซ็นสัญญา (ผู้ให้เช่า)'} sub={contract.unit.roomNumber} />
      <div className="px-4 pt-4 flex flex-col gap-3.5">
        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-primary">
            {contract.landlordSignedAt ? 'เจ้าของเซ็นแล้ว' : 'รอผู้ให้เช่าเซ็น'}
            {contract.tenantSignedAt ? ' · ผู้เช่าเซ็นแล้ว' : ''}
          </span>
          {contract.startDate && contract.endDate && (
            <strong className="font-display text-xl">
              {thaiDate(contract.startDate)} – {thaiDate(contract.endDate)}
            </strong>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted">ค่าเช่า</span>
            <span>{money(contract.rentAmount)} / เดือน</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">มัดจำ</span>
            <span>{money(contract.deposit)}</span>
          </div>
          <button
            type="button"
            className="text-sm font-bold text-primary text-left"
            onClick={() => openPdfViewer(nav, `contracts/${id}/pdf`, { title: 'สัญญาเช่า' })}
          >
            อ่านสัญญาฉบับเต็ม (PDF)
          </button>
          {contract.signedDocumentUrl && (
            <button
              type="button"
              className="text-sm font-bold text-primary text-left"
              onClick={() => openPdfViewer(nav, `contracts/${id}/signed`, { title: 'สัญญาที่ลงนามแล้ว' })}
            >
              ดู PDF ที่ลงนามแล้ว
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex justify-between items-baseline">
            <strong className="text-[15px]">ลายเซ็นของคุณ</strong>
            <button
              type="button"
              className="py-2 text-sm font-bold text-primary"
              onClick={() => {
                padRef.current?.clear()
                setHasInk(false)
              }}
            >
              ล้าง
            </button>
          </div>
          <div className="relative h-[220px] rounded-card border-[1.5px] border-dashed border-placeholder bg-white overflow-hidden">
            <SignaturePad bare apiRef={padRef} onChange={setHasInk} />
            {!hasInk && (
              <span className="pointer-events-none absolute left-4 bottom-3 text-xs text-muted">เซ็นในกรอบนี้ด้วยนิ้ว</span>
            )}
          </div>
          {alreadySigned && <p className="text-[13px] text-muted">คุณลงนามแล้ว เซ็นใหม่จะทับลายเซ็นเดิม</p>}
        </section>

        <label className="flex gap-2.5 items-start text-sm leading-normal">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-5 h-5 mt-0.5 accent-primary"
          />
          ฉันได้อ่านและยอมรับเงื่อนไขในสัญญา ลายเซ็นนี้มีผลเท่ากับการลงลายมือชื่อ
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-liff mx-auto bg-white border-t border-[#EEF1EF] px-4 pt-3 pb-6">
        <button
          type="button"
          onClick={submit}
          disabled={!hasInk || !consent || saving}
          className="w-full h-[52px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : 'ยืนยันลายเซ็น'}
        </button>
      </div>
    </div>
  )
}
