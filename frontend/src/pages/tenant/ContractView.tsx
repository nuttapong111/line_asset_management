import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { openPdfViewer } from '../../lib/pdfNav'
import { TopBar } from '../../components/layout/TopBar'
import { bahtExact, thaiDate } from '../../lib/utils'

interface Contract {
  id: string
  startDate: string
  endDate: string
  rentAmount: string
  deposit: string
  dueDay: number
  lateFeePerDay: string
  status: string
  contractNo?: string
  signedAt?: string | null
  landlordSignedAt?: string | null
  tenantSignedAt?: string | null
  signedDocumentUrl?: string | null
  renewalRequestedAt?: string | null
  moveOutRequestedAt?: string | null
  tenant: { name: string }
  unit: {
    roomNumber: string
    electricRate?: string | number
    waterRate?: string | number
    property: { name: string }
  }
}

function money(n: string | number) {
  const v = Number(n)
  const digits = Number.isInteger(v) ? 0 : 2
  return '฿' + v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export default function ContractView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [contract, setContract] = useState<Contract>()
  const [ownerName, setOwnerName] = useState('')
  const [error, setError] = useState<string>()
  const [requesting, setRequesting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [renewError, setRenewError] = useState<string>()

  const load = () => {
    const url = id ? `/contracts/${id}` : '/contracts/me'
    api.get(url).then((r) => setContract(r.data)).catch(() => setError('ยังไม่มีสัญญา'))
  }

  useEffect(() => {
    load()
    api.get('/community/meta').then((r) => setOwnerName(r.data?.ownerName || '')).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) {
    return (
      <div>
        <TopBar title="สัญญาเช่า" />
        <p className="p-8 text-center text-muted">{error}</p>
      </div>
    )
  }
  if (!contract) return <div className="p-6"><div className="h-40 rounded-card bg-surface-2" /></div>

  const landlordSigned = Boolean(contract.landlordSignedAt)
  const tenantSigned = Boolean(contract.tenantSignedAt)
  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000)
  const span = new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()
  const elapsed = Date.now() - new Date(contract.startDate).getTime()
  const progress = span > 0 ? Math.min(100, Math.max(8, (elapsed / span) * 100)) : 0
  const showRenew = contract.status === 'ACTIVE' && daysLeft <= 90
  const elec = contract.unit.electricRate != null ? Number(contract.unit.electricRate) : null
  const water = contract.unit.waterRate != null ? Number(contract.unit.waterRate) : null

  const terms: { k: string; v: string }[] = [
    { k: 'ระยะเวลา', v: `${thaiDate(contract.startDate)} – ${thaiDate(contract.endDate)}` },
    { k: 'ค่าเช่า', v: `${money(contract.rentAmount)} / เดือน` },
    { k: 'เงินมัดจำ', v: money(contract.deposit) },
    { k: 'ครบกำหนดชำระ', v: `ทุกวันที่ ${contract.dueDay}` },
    { k: 'ค่าปรับล่าช้า', v: `${money(contract.lateFeePerDay)} / วัน` },
  ]
  if (elec != null && water != null) terms.push({ k: 'ค่าไฟ / ค่าน้ำ', v: `฿${elec} / ฿${water} ต่อหน่วย` })

  function viewPdf() {
    const path = contract!.signedDocumentUrl ? `contracts/${contract!.id}/signed` : `contracts/${contract!.id}/pdf`
    openPdfViewer(nav, path, { title: 'สัญญาเช่า', sub: contract!.unit.roomNumber })
  }

  async function requestMoveOut() {
    setMoving(true)
    setRenewError(undefined)
    try {
      await api.post(`/contracts/${contract!.id}/move-out-request`)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setRenewError(typeof msg === 'string' ? msg : 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setMoving(false)
    }
  }

  async function requestRenew() {
    setRequesting(true)
    try {
      await api.post(`/contracts/${contract!.id}/renew-request`)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setRenewError(typeof msg === 'string' ? msg : 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas pb-36">
      <TopBar title={`สัญญาเช่า ${contract.unit.roomNumber}`} sub={contract.contractNo || contract.unit.property.name} />
      <div className="px-4 pt-4 flex flex-col gap-3.5">
        {showRenew && daysLeft > 0 && (
          <section className="bg-warn-bg rounded-[18px] p-4 flex flex-col gap-2.5">
            <div className="flex justify-between items-baseline">
              <strong className="text-base text-warn-fg">สัญญาจะหมดใน {daysLeft} วัน</strong>
              <span className="text-[13px] text-warn-fg">{thaiDate(contract.endDate)}</span>
            </div>
            <div className="h-2 rounded-full bg-warn-fg/15">
              <div className="h-2 rounded-full bg-warn-fg" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[13px] text-warn-fg">อยากอยู่ต่อ? ส่งคำขอให้เจ้าของได้เลย เจ้าของจะส่งสัญญาใหม่ให้เซ็นใน LINE</span>
          </section>
        )}

        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2.5">
          <strong className="text-[15px]">สาระสำคัญ</strong>
          {terms.map((t) => (
            <div key={t.k} className="flex justify-between gap-3 text-sm">
              <span className="text-muted">{t.k}</span>
              <span className="font-semibold text-right">{t.v}</span>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2.5">
          <strong className="text-[15px]">ลายเซ็น</strong>
          <div className="grid grid-cols-2 gap-2.5">
            <SignBox who="ผู้ให้เช่า" name={ownerName} signedAt={contract.landlordSignedAt} />
            <SignBox who="ผู้เช่า" name={contract.tenant.name} signedAt={contract.tenantSignedAt} />
          </div>
          {contract.status === 'ACTIVE' && !tenantSigned && (
            <button type="button" className="text-sm font-bold text-primary text-left" onClick={() => nav(`/contract/${contract.id}/esign`)}>
              ลงนามสัญญา
            </button>
          )}
        </section>

        <button type="button" onClick={viewPdf} className="bg-white rounded-card px-4 py-3.5 text-left text-ink flex items-center gap-3">
          <span className="w-10 h-10 rounded-[10px] bg-danger-bg text-danger text-[11px] font-extrabold flex items-center justify-center">PDF</span>
          <span className="flex-1 flex flex-col">
            <strong className="text-[15px]">เปิดสัญญาฉบับเต็ม</strong>
            <span className="text-[13px] text-muted">{contract.signedDocumentUrl ? 'ฉบับที่ลงนามแล้ว' : 'ไฟล์ PDF'}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-muted" aria-hidden>
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {!showRenew && (
          contract.moveOutRequestedAt ? (
            <p className="text-center text-sm font-semibold text-muted py-2">แจ้งย้ายออกแล้ว รอเจ้าของดำเนินการ</p>
          ) : (
            <button type="button" onClick={requestMoveOut} disabled={moving} className="h-12 rounded-cta border-[1.5px] border-line-input bg-white text-sm font-semibold text-ink disabled:opacity-50">
              {moving ? 'กำลังส่ง...' : 'แจ้งย้ายออก'}
            </button>
          )
        )}
        {renewError && !showRenew && <p className="text-sm text-danger text-center">{renewError}</p>}
      </div>

      {showRenew && (
        <div className="fixed bottom-0 inset-x-0 max-w-liff mx-auto bg-white border-t border-[#EEF1EF] px-4 pt-3 pb-6 flex flex-col gap-2">
          {renewError && <p className="text-sm text-danger text-center">{renewError}</p>}
          {contract.renewalRequestedAt ? (
            <p className="text-center text-sm font-semibold text-ok-fg py-3">ส่งคำขอต่อสัญญาแล้ว รอเจ้าของยืนยัน</p>
          ) : (
            <button type="button" onClick={requestRenew} disabled={requesting} className="h-[52px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50">
              {requesting ? 'กำลังส่ง...' : 'ขอต่อสัญญา 1 ปี'}
            </button>
          )}
          {contract.moveOutRequestedAt ? (
            <p className="text-center text-sm font-semibold text-muted py-1">แจ้งย้ายออกแล้ว รอเจ้าของดำเนินการ</p>
          ) : (
            <button type="button" onClick={requestMoveOut} disabled={moving} className="h-10 text-sm font-semibold text-muted disabled:opacity-50">
              {moving ? 'กำลังส่ง...' : 'แจ้งย้ายออก'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SignBox({ who, name, signedAt }: { who: string; name?: string; signedAt?: string | null }) {
  return (
    <div className="border border-[#DCE3DF] rounded-xl px-3 py-2.5 flex flex-col gap-1">
      <span className="text-xs text-muted">{who}</span>
      <span className="font-display text-lg italic text-info truncate">{name || '—'}</span>
      <span className={`text-xs font-bold ${signedAt ? 'text-ok-fg' : 'text-warn-fg'}`}>
        {signedAt ? `เซ็นแล้ว ${thaiDate(signedAt)}` : 'ยังไม่เซ็น'}
      </span>
    </div>
  )
}
