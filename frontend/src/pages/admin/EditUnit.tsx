import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht } from '../../lib/utils'

interface Fee { id: string; label: string; amount: string }
interface Unit {
  id: string
  roomNumber: string
  floor?: number | null
  rentPrice: string
  electricRate: string
  waterRate: string
  commonFee: string
  property: { id: string; name: string }
  recurringFees: Fee[]
}

export default function EditUnit() {
  const { unitId } = useParams()
  const nav = useNavigate()
  const [unit, setUnit] = useState<Unit>()
  const [form, setForm] = useState({ roomNumber: '', floor: '', rentPrice: '', electricRate: '', waterRate: '', commonFee: '' })
  const [feeLabel, setFeeLabel] = useState('')
  const [feeAmount, setFeeAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const load = () =>
    api.get(`/units/${unitId}`).then((r) => {
      const u: Unit = r.data
      setUnit(u)
      setForm({
        roomNumber: u.roomNumber,
        floor: u.floor != null ? String(u.floor) : '',
        rentPrice: String(Number(u.rentPrice)),
        electricRate: String(Number(u.electricRate)),
        waterRate: String(Number(u.waterRate)),
        commonFee: String(Number(u.commonFee)),
      })
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
      nav(`/admin/property/${unit!.property.id}`)
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
    await load()
  }

  async function removeFee(id: string) {
    await api.delete(`/units/${unitId}/fees/${id}`)
    await load()
  }

  if (!unit) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div className="pb-6">
      <TopBar title={`ห้อง ${unit.roomNumber}`} />
      <div className="p-4 space-y-4">
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
          <Button onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกห้อง'}</Button>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">รายการเรียกเก็บรายเดือน</h3>
          <p className="text-xs text-gray-400">เช่น ค่าจอดรถ ค่าเน็ต ค่าเฟอร์นิเจอร์ — จะถูกใส่ในบิลค่าเช่าอัตโนมัติ</p>
          {unit.recurringFees.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50">
              <span>{f.label}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{baht(f.amount)}</span>
                <button type="button" className="text-danger text-xs" onClick={() => removeFee(f.id)}>ลบ</button>
              </div>
            </div>
          ))}
          {unit.recurringFees.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีรายการเพิ่ม</p>}
          <div className="grid grid-cols-[1fr_90px_auto] gap-2 items-end">
            <Input label="รายการ" value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} placeholder="ค่าจอดรถ" />
            <Input label="ยอด" type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
            <Button className="py-2.5 w-auto px-3" onClick={addFee} disabled={!feeLabel || !feeAmount}>เพิ่ม</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
