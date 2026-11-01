import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { baht, cls, thaiDate } from '../../lib/utils'

interface Fee { id: string; label: string; amount: string }
interface Tenant { id: string; name: string }
interface Unit {
  id: string
  roomNumber: string
  floor?: number | null
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
  rentPrice: string
  electricRate: string
  waterRate: string
  commonFee: string
  property: { id: string; name: string }
  recurringFees: Fee[]
  tenants: Tenant[]
}
interface ContractLite {
  id: string
  endDate?: string
  renewalRequestedAt?: string | null
}

const STATUSES = [
  { key: 'OCCUPIED', label: 'มีผู้เช่า' },
  { key: 'VACANT', label: 'ว่าง' },
  { key: 'MAINTENANCE', label: 'ปิดซ่อม' },
] as const

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] font-semibold text-ink bg-white'

export default function EditUnit() {
  const { unitId } = useParams()
  const nav = useNavigate()
  const [unit, setUnit] = useState<Unit>()
  const [contract, setContract] = useState<ContractLite>()
  const [form, setForm] = useState({ roomNumber: '', floor: '', rentPrice: '', electricRate: '', waterRate: '', commonFee: '' })
  const [status, setStatus] = useState<Unit['status']>('VACANT')
  const [feeLabel, setFeeLabel] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const load = () =>
    api.get(`/units/${unitId}`).then(async (r) => {
      const u: Unit = r.data
      setUnit(u)
      setStatus(u.status)
      setForm({
        roomNumber: u.roomNumber,
        floor: u.floor != null ? String(u.floor) : '',
        rentPrice: String(Number(u.rentPrice)),
        electricRate: String(Number(u.electricRate)),
        waterRate: String(Number(u.waterRate)),
        commonFee: String(Number(u.commonFee)),
      })
      try {
        const prop = await api.get(`/properties/${u.property.id}`)
        const found = (prop.data.units as { id: string; contracts?: ContractLite[] }[]).find((x) => x.id === u.id)
        setContract(found?.contracts?.[0])
      } catch {
        setContract(undefined)
      }
    })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      await api.put(`/units/${unitId}`, {
        roomNumber: form.roomNumber,
        floor: form.floor ? Number(form.floor) : undefined,
        rentPrice: Number(form.rentPrice),
        electricRate: Number(form.electricRate),
        waterRate: Number(form.waterRate),
        commonFee: Number(form.commonFee),
      })
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function addFee() {
    if (!feeLabel.trim() || !feeAmount) return
    await api.post(`/units/${unitId}/fees`, { label: feeLabel.trim(), amount: Number(feeAmount) })
    setFeeLabel('')
    setFeeAmount('')
    setAdding(false)
    await load()
  }

  async function removeFee(id: string) {
    await api.delete(`/units/${unitId}/fees/${id}`)
    await load()
  }

  if (!unit) {
    return (
      <div>
        <TopBar title="ห้อง" />
        <div className="p-4"><div className="h-28 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  const tenant = unit.tenants[0]
  const renewal = Boolean(contract?.renewalRequestedAt)

  return (
    <div className="pb-28">
      <TopBar
        title={`ห้อง ${unit.roomNumber}`}
        sub={`${unit.property.name}${unit.floor != null ? ` · ชั้น ${unit.floor}` : ''}`}
        right={
          <button type="button" className="text-primary text-sm font-bold" onClick={save} disabled={saving}>
            {saving ? '...' : 'บันทึก'}
          </button>
        }
      />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        {tenant && (
          <button
            type="button"
            className="bg-white rounded-card p-3.5 text-left flex items-center gap-3"
            onClick={() => contract && nav(`/admin/contract/${contract.id}`)}
          >
            <span className="w-11 h-11 rounded-full bg-info-bg text-info font-bold flex items-center justify-center">
              {tenant.name.replace(/^คุณ/, '').slice(0, 1)}
            </span>
            <span className="flex-1 flex flex-col min-w-0">
              <strong className="text-[15px] truncate">{tenant.name}</strong>
              <span className="text-[13px] text-muted truncate">
                {contract?.endDate ? `สัญญาถึง ${thaiDate(contract.endDate)}` : 'มีผู้เช่า'}
                {renewal ? ' · ขอต่อสัญญาแล้ว' : ''}
              </span>
            </span>
            {renewal && <span className="px-2.5 py-0.5 rounded-full bg-warn-bg text-warn-fg text-xs font-bold">รออนุมัติต่อ</span>}
          </button>
        )}

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-3">
          <strong className="text-sm">สถานะห้อง</strong>
          <div role="radiogroup" aria-label="สถานะห้อง" className="grid grid-cols-3 gap-1.5">
            {STATUSES.map((s) => {
              const on = status === s.key
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStatus(s.key)}
                  className={cls(
                    'h-10 rounded-[10px] text-sm',
                    on ? 'border-2 border-primary bg-primary-soft font-bold text-ok-fg' : 'border-[1.5px] border-line-soft bg-white font-semibold text-muted'
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          {status !== unit.status && (
            <p className="text-xs text-muted">สถานะบนเซิร์ฟเวอร์ยังเป็นค่าเดิม — ปุ่มบันทึกเก็บค่าเช่าและเรท</p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าเช่า / เดือน
              <input className={fieldCls} inputMode="decimal" value={form.rentPrice} onChange={set('rentPrice')} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าส่วนกลาง
              <input className={fieldCls} inputMode="decimal" value={form.commonFee} onChange={set('commonFee')} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าไฟ / หน่วย
              <input className={fieldCls} inputMode="decimal" value={form.electricRate} onChange={set('electricRate')} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าน้ำ / หน่วย
              <input className={fieldCls} inputMode="decimal" value={form.waterRate} onChange={set('waterRate')} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            เลขห้อง
            <input className={fieldCls} value={form.roomNumber} onChange={set('roomNumber')} />
          </label>
          {error && <p className="text-danger text-sm">{error}</p>}
        </section>

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2.5">
          <strong className="text-sm">ค่าใช้จ่ายประจำ (รวมในบิลค่าเช่า)</strong>
          {unit.recurringFees.map((f) => (
            <div key={f.id} className="flex justify-between items-center text-sm py-2 border-b border-line-soft">
              <span>{f.label}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold">{baht(f.amount)}</span>
                <button type="button" className="text-danger text-xs font-bold" onClick={() => removeFee(f.id)} aria-label={`ลบ ${f.label}`}>
                  ลบ
                </button>
              </span>
            </div>
          ))}
          {unit.recurringFees.length === 0 && <p className="text-sm text-muted">ยังไม่มีรายการ</p>}
          {adding ? (
            <div className="flex gap-2 items-center">
              <input aria-label="ชื่อรายการ" className={`${fieldCls} flex-1`} value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} placeholder="ที่จอดรถ" />
              <input aria-label="จำนวนเงิน" className={`${fieldCls} w-24`} inputMode="decimal" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
              <button type="button" className="text-primary text-sm font-bold" onClick={addFee}>เพิ่ม</button>
            </div>
          ) : (
            <button type="button" className="self-start h-8 text-sm font-bold text-primary" onClick={() => setAdding(true)}>
              + เพิ่มรายการ
            </button>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-2 gap-2.5">
        {contract ? (
          <button type="button" className="h-[50px] rounded-cta bg-danger-bg text-danger text-[15px] font-bold" onClick={() => nav(`/admin/contract/${contract.id}/move-out`)}>
            ย้ายออก
          </button>
        ) : (
          <button type="button" className="h-[50px] rounded-cta bg-surface-2 text-ink text-[15px] font-semibold" onClick={() => nav(`/admin/property/${unit.property.id}`)}>
            กลับอาคาร
          </button>
        )}
        {tenant && renewal && contract ? (
          <button type="button" className="h-[50px] rounded-cta bg-primary text-white text-[15px] font-bold" onClick={() => nav(`/admin/contract/${contract.id}`)}>
            อนุมัติต่อสัญญา
          </button>
        ) : !tenant ? (
          <button type="button" className="h-[50px] rounded-cta bg-primary text-white text-[15px] font-bold" onClick={() => nav(`/admin/property/${unit.property.id}/tenant/new?unitId=${unit.id}`)}>
            รับผู้เช่า
          </button>
        ) : (
          <button type="button" className="h-[50px] rounded-cta bg-primary text-white text-[15px] font-bold" onClick={save} disabled={saving}>
            บันทึก
          </button>
        )}
      </div>
    </div>
  )
}
