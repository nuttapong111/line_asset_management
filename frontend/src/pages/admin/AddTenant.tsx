import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

export type TenantDraft = {
  name: string
  phone: string
  lineId: string
  idCardNumber: string
}

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] text-ink bg-white'

/** Step 1 — draft only (not saved). Tenant is created with the contract in step 2. */
export default function AddTenant() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const unitId = params.get('unitId') || ''
  const [form, setForm] = useState<TenantDraft>({ name: '', phone: '', lineId: '', idCardNumber: '' })
  const [error, setError] = useState<string>()

  const set = (k: keyof TenantDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  function next() {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    if (!unitId) {
      setError('ไม่พบห้องที่เลือก')
      return
    }
    nav(`/admin/unit/${unitId}/onboard`, {
      state: {
        name: form.name.trim(),
        phone: form.phone.trim(),
        lineId: form.lineId.trim() || undefined,
        idCardNumber: form.idCardNumber.trim() || undefined,
      },
    })
  }

  return (
    <div className="pb-28">
      <TopBar title="รับผู้เช่า" sub="ข้อมูลผู้เช่า" />
      <div className="px-4 py-3.5 flex flex-col gap-3.5">
        <Stepper step={1} />
        <section className="bg-white rounded-card p-3.5 flex flex-col gap-3">
          <p className="text-xs text-muted">ยังไม่บันทึก — กดกลับได้โดยไม่ผูกผู้เช่า</p>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            ชื่อ-นามสกุล
            <input className={fieldCls} value={form.name} onChange={set('name')} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            เบอร์โทร
            <input className={fieldCls} value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxx" inputMode="tel" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            LINE ID (ไม่บังคับ)
            <input className={fieldCls} value={form.lineId} onChange={set('lineId')} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            เลขบัตรประชาชน (ไม่บังคับ)
            <input className={fieldCls} value={form.idCardNumber} onChange={set('idCardNumber')} />
          </label>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </section>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6">
        <button type="button" className="w-full h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold" onClick={next}>
          ถัดไป: สัญญา
        </button>
      </div>
    </div>
  )
}
