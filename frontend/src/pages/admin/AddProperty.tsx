import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

export default function AddProperty() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', address: '', bankName: '', bankAccount: '', promptpayNumber: '' })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function submit() {
    if (!form.name || !form.promptpayNumber) {
      setError('กรุณากรอกชื่ออสังหาฯและเบอร์พร้อมเพย์')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/properties', form)
      nav(`/admin/property/${data.id}`, { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="เพิ่มอสังหาฯใหม่" />
      <div className="p-4">
        <Card className="space-y-4">
          <Input label="ชื่ออสังหาฯ *" value={form.name} onChange={set('name')} placeholder="เช่น คอนโด สุขุมวิท 31" />
          <Input label="ที่อยู่" value={form.address} onChange={set('address')} />
          <Input label="ธนาคาร" value={form.bankName} onChange={set('bankName')} />
          <Input label="เลขบัญชี" value={form.bankAccount} onChange={set('bankAccount')} />
          <Input label="เบอร์พร้อมเพย์ *" value={form.promptpayNumber} onChange={set('promptpayNumber')} placeholder="0812345678" />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </Card>
      </div>
    </div>
  )
}
