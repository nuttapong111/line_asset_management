import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'
import { cls } from '../../lib/utils'

const DURATIONS = [
  { label: '6 เดือน', months: 6 },
  { label: '1 ปี', months: 12 },
  { label: '2 ปี', months: 24 },
]

type Draft = {
  name?: string
  phone?: string
  lineId?: string
  idCardNumber?: string
}

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] font-semibold text-ink bg-white'

/**
 * Step 2 — create contract.
 * - New flow: /admin/unit/:unitId/onboard + location.state (tenant draft) → POST /tenants/onboard
 * - Resume: /admin/tenant/:tenantId/contract?unitId= → POST /contracts
 */
export default function ContractSetup() {
  const nav = useNavigate()
  const { tenantId, unitId: unitIdParam } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const draft = (location.state || {}) as Draft

  const unitId = unitIdParam || params.get('unitId') || ''
  const isOnboard = Boolean(draft.name && draft.phone && unitId && !tenantId)

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    startDate: today,
    months: 12,
    rentAmount: '',
    deposit: '',
    dueDay: '5',
    lateFeePerDay: '30',
    terms: '',
  })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [roomLabel, setRoomLabel] = useState('')
  const [tenantName, setTenantName] = useState(draft.name || '')

  useEffect(() => {
    if (!unitId) return
    api.get(`/units/${unitId}`).then((r) => {
      const u = r.data
      setRoomLabel(u.roomNumber)
      if (!form.rentAmount && u.rentPrice != null) {
        const rent = String(Number(u.rentPrice) || '')
        setForm((f) => ({
          ...f,
          rentAmount: f.rentAmount || rent,
          deposit: f.deposit || (rent ? String(Number(rent) * 2) : ''),
        }))
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId])

  useEffect(() => {
    if (!tenantId || draft.name) return
    api.get(`/tenants/${tenantId}`).then((r) => setTenantName(r.data.name)).catch(() => {})
  }, [tenantId, draft.name])

  function endDate(): string {
    const d = new Date(form.startDate)
    d.setMonth(d.getMonth() + form.months)
    return d.toISOString().slice(0, 10)
  }

  async function next() {
    if (!form.rentAmount || !form.deposit) {
      setError('กรุณากรอกค่าเช่าและเงินประกัน')
      return
    }
    if (!unitId) {
      setError('ไม่พบห้อง')
      return
    }
    if (isOnboard && (!draft.name || !draft.phone)) {
      setError('ไม่พบข้อมูลผู้เช่า — กลับไปกรอกชื่อ/เบอร์ใหม่')
      return
    }
    if (!isOnboard && !tenantId) {
      setError('ไม่พบผู้เช่า')
      return
    }

    setSaving(true)
    setError(undefined)
    try {
      if (isOnboard) {
        const { data } = await api.post('/tenants/onboard', {
          name: draft.name,
          phone: draft.phone,
          lineId: draft.lineId,
          idCardNumber: draft.idCardNumber,
          unitId,
          startDate: form.startDate,
          endDate: endDate(),
          rentAmount: Number(form.rentAmount),
          deposit: Number(form.deposit),
          dueDay: Number(form.dueDay),
          lateFeePerDay: Number(form.lateFeePerDay),
          terms: form.terms || undefined,
        })
        nav(`/admin/tenant/${data.tenant.id}/invite`, { replace: true })
      } else {
        await api.post('/contracts', {
          tenantId,
          unitId,
          startDate: form.startDate,
          endDate: endDate(),
          rentAmount: Number(form.rentAmount),
          deposit: Number(form.deposit),
          dueDay: Number(form.dueDay),
          lateFeePerDay: Number(form.lateFeePerDay),
          terms: form.terms || undefined,
        })
        nav(`/admin/tenant/${tenantId}/invite`, { replace: true })
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  if (!isOnboard && !tenantId && !draft.name) {
    return (
      <div>
        <TopBar title="รับผู้เช่า" />
        <p className="p-6 text-center text-sm text-muted">ไม่พบข้อมูลผู้เช่า</p>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <TopBar title={roomLabel ? `รับผู้เช่า · ห้อง ${roomLabel}` : 'รับผู้เช่า · สัญญา'} sub={tenantName || undefined} />
      <div className="px-4 py-3.5 flex flex-col gap-3.5">
        <Stepper step={2} />
        <section className="bg-white rounded-card p-3.5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              วันเริ่ม
              <input type="date" className={fieldCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              วันสิ้นสุด
              <input className={`${fieldCls} bg-surface-2 text-muted`} readOnly value={endDate()} />
            </label>
          </div>
          <div className="flex gap-1.5">
            {DURATIONS.map((d) => {
              const on = form.months === d.months
              return (
                <button
                  key={d.months}
                  type="button"
                  aria-pressed={on}
                  className={cls(
                    'h-8 px-3 rounded-full text-[13px] border-[1.5px]',
                    on ? 'border-primary bg-primary-soft text-ok-fg font-bold' : 'border-line-soft bg-white font-semibold'
                  )}
                  onClick={() => setForm({ ...form, months: d.months })}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าเช่า / เดือน
              <input className={fieldCls} inputMode="decimal" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              เงินมัดจำ
              <input className={fieldCls} inputMode="decimal" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ครบกำหนดทุกวันที่ (1–28)
              <input className={fieldCls} inputMode="numeric" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              ค่าปรับ / วัน
              <input className={fieldCls} inputMode="decimal" value={form.lateFeePerDay} onChange={(e) => setForm({ ...form, lateFeePerDay: e.target.value })} />
            </label>
          </div>
          <span className="text-xs text-muted -mt-1">มัดจำแนะนำ 2 เดือน</span>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            เงื่อนไขเพิ่มเติม
            <textarea className="h-16 box-border border-[1.5px] border-line-input rounded-input p-2.5 text-sm text-ink resize-none" value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
          </label>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </section>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6">
        <button type="button" className="w-full h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold disabled:opacity-50" onClick={next} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'ถัดไป: ส่งคำเชิญ'}
        </button>
      </div>
    </div>
  )
}
