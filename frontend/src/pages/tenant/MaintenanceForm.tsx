import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input, Textarea } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { cls } from '../../lib/utils'

const CATS = [
  { key: 'ELECTRIC', label: 'ไฟฟ้า', icon: '⚡' },
  { key: 'PLUMBING', label: 'ประปา', icon: '🚰' },
  { key: 'APPLIANCE', label: 'เครื่องใช้ไฟฟ้า', icon: '🔌' },
  { key: 'GENERAL', label: 'ทั่วไป', icon: '🔧' },
] as const

export default function MaintenanceForm() {
  const nav = useNavigate()
  const [category, setCategory] = useState<string>('GENERAL')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title) {
      setError('กรุณากรอกหัวข้อ')
      return
    }
    setSaving(true)
    try {
      await api.post('/maintenance', { category, title, description })
      nav('/tenant/maintenance', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'ส่งไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div>
      <TopBar title="แจ้งซ่อมใหม่" />
      <div className="p-4 space-y-4">
        <Card>
          <span className="block text-sm font-medium text-gray-600 mb-2">ประเภท</span>
          <div className="grid grid-cols-4 gap-2">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cls('rounded-xl py-3 border flex flex-col items-center gap-1', category === c.key ? 'border-line bg-line-light' : 'border-gray-200')}
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-[10px]">{c.label}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="space-y-3">
          <Input label="หัวข้อ *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น แอร์ไม่เย็น" />
          <Textarea label="รายละเอียด" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={submit} disabled={saving}>{saving ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งซ่อม'}</Button>
        </Card>
      </div>
    </div>
  )
}
