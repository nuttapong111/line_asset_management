import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

export default function AddUnit() {
  const nav = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState({ roomNumber: '', floor: '', rentPrice: '', electricRate: '5', waterRate: '18', commonFee: '0' })
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function submit() {
    if (!form.roomNumber || !form.rentPrice) {
      setError('กรุณากรอกเลขห้องและราคาเช่า')
      return
    }
    setSaving(true)
    try {
      await api.post(`/properties/${id}/units`, {
        roomNumber: form.roomNumber,
        floor: form.floor ? Number(form.floor) : undefined,
        rentPrice: Number(form.rentPrice),
        electricRate: Number(form.electricRate),
        waterRate: Number(form.waterRate),
        commonFee: Number(form.commonFee),
      })
      nav(`/admin/property/${id}`, { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="เพิ่มห้องใหม่" />
      <div className="p-4">
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="เลขห้อง *" value={form.roomNumber} onChange={set('roomNumber')} />
            <Input label="ชั้น" type="number" value={form.floor} onChange={set('floor')} />
          </div>
          <Input label="ราคาเช่า/เดือน *" type="number" value={form.rentPrice} onChange={set('rentPrice')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="ค่าไฟ/หน่วย" type="number" value={form.electricRate} onChange={set('electricRate')} />
            <Input label="ค่าน้ำ/หน่วย" type="number" value={form.waterRate} onChange={set('waterRate')} />
          </div>
          <Input label="ค่าส่วนกลาง" type="number" value={form.commonFee} onChange={set('commonFee')} />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={submit} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </Card>
      </div>
    </div>
  )
}
