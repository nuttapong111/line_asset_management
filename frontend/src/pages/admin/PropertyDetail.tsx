import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { baht, cls, thaiDate } from '../../lib/utils'
import { TopBar } from '../../components/layout/TopBar'
import { AuthImage } from '../../components/AuthImage'

interface Unit {
  id: string
  roomNumber: string
  floor?: number | null
  rentPrice: string
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
  tenants: { id: string; name: string; linkedAt?: string | null }[]
  invoices: { id: string; status: string }[]
  contracts: { id: string; endDate?: string; signedAt?: string | null }[]
}
interface Property {
  id: string
  name: string
  bankName?: string
  bankAccount?: string
  promptpayNumber: string
  paymentQrUrl?: string | null
  units: Unit[]
}

function maskPay(n: string) {
  const d = n.replace(/\D/g, '')
  if (d.length < 4) return n
  return `xxx-x-x${d.slice(-5, -1)}-${d.slice(-1)}`
}

export default function PropertyDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [prop, setProp] = useState<Property>()
  const [qrUploading, setQrUploading] = useState(false)

  const load = () => api.get(`/properties/${id}`).then((r) => setProp(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function uploadQr(file: File) {
    setQrUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/properties/${id}/payment-qr`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
    } finally {
      setQrUploading(false)
    }
  }

  async function removeQr() {
    await api.delete(`/properties/${id}/payment-qr`)
    await load()
  }

  if (!prop) {
    return (
      <div>
        <TopBar title="อาคาร" />
        <div className="p-4"><div className="h-24 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  const occupied = prop.units.filter((u) => u.status === 'OCCUPIED').length
  const vacant = prop.units.filter((u) => u.status === 'VACANT').length
  const maint = prop.units.filter((u) => u.status === 'MAINTENANCE').length
  const floors = Array.from(new Set(prop.units.map((u) => u.floor ?? 0))).sort((a, b) => a - b)

  return (
    <div className="pb-28">
      <TopBar title={prop.name} sub={`PromptPay ${maskPay(prop.promptpayNumber)}`} />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Count label="มีผู้เช่า" n={occupied} />
          <Count label="ว่าง" n={vacant} />
          <Count label="ปิดซ่อม" n={maint} />
        </div>

        {floors.map((f) => {
          const rooms = prop.units.filter((u) => (u.floor ?? 0) === f)
          return (
            <section key={String(f)} className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-muted">ชั้น {f || '-'}</span>
              <div className="bg-white rounded-card overflow-hidden">
                {rooms.map((u) => {
                  const tenant = u.tenants[0]
                  const contract = u.contracts[0]
                  const overdue = u.invoices[0]?.status === 'OVERDUE'
                  const chip =
                    u.status === 'VACANT'
                      ? 'bg-surface-2 text-neutral-fg'
                      : u.status === 'MAINTENANCE'
                        ? 'bg-warn-bg text-warn-fg'
                        : overdue
                          ? 'bg-danger text-white'
                          : 'bg-ok-bg text-ok-fg'
                  const tag =
                    u.status === 'VACANT' ? 'รับผู้เช่า' : u.status === 'MAINTENANCE' ? 'ปิดซ่อม' : overdue ? 'ค้างชำระ' : ''
                  const tagColor =
                    u.status === 'VACANT' ? 'text-primary' : u.status === 'MAINTENANCE' || overdue ? 'text-warn-fg' : 'text-muted'
                  const overdueColor = overdue ? 'text-danger' : tagColor
                  const sub =
                    u.status === 'VACANT'
                      ? `${baht(u.rentPrice)} · ว่าง`
                      : u.status === 'MAINTENANCE'
                        ? 'ปิดซ่อม'
                        : `${baht(u.rentPrice)}${contract?.endDate ? ` · สัญญาหมด ${thaiDate(contract.endDate)}` : ''}`
                  const href =
                    u.status === 'VACANT'
                      ? `/admin/property/${id}/tenant/new?unitId=${u.id}`
                      : `/admin/unit/${u.id}`
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full px-3.5 py-2.5 border-b border-line-soft text-left flex items-center gap-3"
                      onClick={() => nav(href)}
                    >
                      <span className={cls('w-[46px] h-10 rounded-[10px] text-[13px] font-bold flex items-center justify-center', chip)}>
                        {u.roomNumber}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <strong className="text-sm truncate">{tenant ? tenant.name : u.status === 'MAINTENANCE' ? 'ปิดซ่อม' : 'ห้องว่าง'}</strong>
                        <span className="text-xs text-muted truncate">{sub}</span>
                      </span>
                      {tag && <span className={cls('text-xs font-bold', overdue ? overdueColor : tagColor)}>{tag}</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2">
          <strong className="text-sm">ข้อมูลรับชำระเงิน</strong>
          <div className="text-sm flex justify-between"><span className="text-muted">ธนาคาร</span><span>{prop.bankName || '-'}</span></div>
          <div className="text-sm flex justify-between"><span className="text-muted">เลขบัญชี</span><span>{prop.bankAccount || '-'}</span></div>
          <div className="text-sm flex justify-between"><span className="text-muted">พร้อมเพย์</span><span>{prop.promptpayNumber}</span></div>
          {prop.paymentQrUrl ? (
            <div className="space-y-2 pt-1">
              <AuthImage path={`/properties/${id}/payment-qr`} alt="QR รับเงิน" className="w-40 h-40 object-contain border border-line-soft rounded-button mx-auto bg-white" />
              <button type="button" className="w-full h-11 rounded-button bg-danger-bg text-danger font-bold" onClick={removeQr}>
                ลบรูป QR
              </button>
            </div>
          ) : (
            <label className="h-12 rounded-button border-[1.5px] border-dashed border-placeholder flex items-center justify-center text-primary text-[15px] font-bold">
              {qrUploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป QR'}
              <input type="file" accept="image/png,image/jpeg" className="hidden" disabled={qrUploading} onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])} />
            </label>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-2 gap-2.5">
        <button type="button" className="h-[50px] rounded-cta border-[1.5px] border-primary text-primary text-[15px] font-bold" onClick={() => nav(`/admin/property/${id}/meter`)}>
          จดมิเตอร์ทั้งตึก
        </button>
        <button type="button" className="h-[50px] rounded-cta bg-primary text-white text-[15px] font-bold" onClick={() => nav(`/admin/property/${id}/unit/new`)}>
          + เพิ่มห้อง
        </button>
      </div>
    </div>
  )
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <div className="bg-white rounded-[14px] px-3 py-2.5 flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <strong className="text-lg">{n}</strong>
    </div>
  )
}
