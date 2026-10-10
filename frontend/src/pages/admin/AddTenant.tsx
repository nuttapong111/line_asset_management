import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

export type TenantDraft = {
  name: string
  phone: string
  lineId: string
  idCardNumber: string
}

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
    <div>
      <TopBar title="เพิ่มผู้เช่า" />
      <div className="p-4 space-y-4">
        <Stepper step={1} />
        <Card className="space-y-4">
          <p className="text-xs text-gray-400">ยังไม่บันทึก — กดกลับได้โดยไม่ผูกผู้เช่า</p>
          <Input label="ชื่อ-นามสกุล *" value={form.name} onChange={set('name')} />
          <Input label="เบอร์โทร *" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxx" />
          <details className="text-sm">
            <summary className="text-gray-400 cursor-pointer select-none py-1">ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>
            <div className="space-y-3 mt-3">
              <Input label="LINE ID" value={form.lineId} onChange={set('lineId')} />
              <Input label="เลขบัตรประชาชน" value={form.idCardNumber} onChange={set('idCardNumber')} />
            </div>
          </details>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={next}>ถัดไป — ตั้งค่าสัญญา</Button>
        </Card>
      </div>
    </div>
  )
}
