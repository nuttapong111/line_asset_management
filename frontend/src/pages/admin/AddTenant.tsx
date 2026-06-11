import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

export default function AddTenant() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const unitId = params.get('unitId') || ''
  const [form, setForm] = useState({ name: '', phone: '', lineId: '', idCardNumber: '', startDate: new Date().toISOString().slice(0, 10) })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function next() {
    if (!form.name || !form.phone) {
      setError('กรุณากรอกชื่อและเบอร์โทร')
      return
    }
    if (!unitId) {
      setError('ไม่พบห้องที่เลือก')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/tenants', { ...form, unitId })
      nav(`/admin/tenant/${data.id}/contract?unitId=${unitId}`)
    } catch (e: any) {
      setError(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="เพิ่มผู้เช่า" />
      <div className="p-4 space-y-4">
        <Stepper step={1} />
        <Card className="space-y-4">
          <Input label="ชื่อ-นามสกุล *" value={form.name} onChange={set('name')} />
          <Input label="เบอร์โทร *" value={form.phone} onChange={set('phone')} placeholder="08xxxxxxxx" />
          <Input label="LINE ID" value={form.lineId} onChange={set('lineId')} />
          <Input label="เลขบัตรประชาชน" value={form.idCardNumber} onChange={set('idCardNumber')} />
          <Input label="วันเริ่มเช่า" type="date" value={form.startDate} onChange={set('startDate')} />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={next} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'ถัดไป'}</Button>
        </Card>
      </div>
    </div>
  )
}
