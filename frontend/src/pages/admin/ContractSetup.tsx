import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input, Textarea, Chip } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

const DURATIONS = [
  { label: '6 เดือน', months: 6 },
  { label: '1 ปี', months: 12 },
  { label: '2 ปี', months: 24 },
]

export default function ContractSetup() {
  const nav = useNavigate()
  const { tenantId } = useParams()
  const [params] = useSearchParams()
  const unitId = params.get('unitId') || ''

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
    setSaving(true)
    try {
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
      nav(`/admin/tenant/${tenantId}/invite`)
    } catch (e: any) {
      setError(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="ตั้งค่าสัญญา" />
      <div className="p-4 space-y-4">
        <Stepper step={2} />
        <Card className="space-y-4">
          <Input label="วันเริ่มเช่า" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <div>
            <span className="block text-sm font-medium text-gray-600 mb-2">ระยะสัญญา</span>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <Chip key={d.months} active={form.months === d.months} onClick={() => setForm({ ...form, months: d.months })}>
                  {d.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">สิ้นสุด: {endDate()}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ค่าเช่า *" type="number" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
            <Input label="เงินประกัน *" type="number" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="วันครบกำหนด" type="number" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} />
            <Input label="ค่าปรับ/วัน" type="number" value={form.lateFeePerDay} onChange={(e) => setForm({ ...form, lateFeePerDay: e.target.value })} />
          </div>
          <Textarea label="เงื่อนไขเพิ่มเติม" rows={3} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={next} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'ถัดไป'}</Button>
        </Card>
      </div>
    </div>
  )
}
