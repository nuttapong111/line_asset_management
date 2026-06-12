import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

interface Owner {
  id: string
  name: string
  phone?: string
  linkedAt?: string
  inviteUrl: string
}

export default function OwnerManage() {
  const { id } = useParams()
  const [owners, setOwners] = useState<Owner[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string>()

  const load = () => api.get(`/properties/${id}/owners`).then((r) => setOwners(r.data)).catch(() => {})
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function add() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post(`/properties/${id}/owners`, { name: name.trim(), phone: phone.trim() || undefined })
      setName('')
      setPhone('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function copy(o: Owner) {
    let url = o.inviteUrl
    try {
      const { data } = await api.get(`/owners/${o.id}/invite-link`)
      url = data.inviteUrl
    } catch {
      /* fall back to existing url */
    }
    navigator.clipboard.writeText(url)
    setCopiedId(o.id)
    setTimeout(() => setCopiedId(undefined), 1500)
  }

  async function remove(o: Owner) {
    if (!confirm(`ลบเจ้าของ "${o.name}" ?`)) return
    await api.delete(`/owners/${o.id}`)
    await load()
  }

  return (
    <div>
      <TopBar title="จัดการเจ้าของ" />
      <div className="p-4 space-y-4">
        <div className="bg-line-light rounded-xl p-3 text-sm text-line-dark">
          เจ้าของที่เชิญเข้ามาจะได้รับแจ้งเตือนทาง LINE เมื่อผู้เช่าชำระเงินหรือมีรายการแจ้งซ่อม และเข้ามาตรวจสอบรายการได้
        </div>

        <Card>
          <h3 className="font-semibold mb-2">เพิ่มเจ้าของ</h3>
          <div className="space-y-2">
            <Input label="ชื่อเจ้าของ" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณสมชาย" />
            <Input label="เบอร์โทร (ไม่บังคับ)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
            <Button onClick={add} disabled={saving || !name.trim()}>{saving ? 'กำลังบันทึก...' : 'สร้างคำเชิญ'}</Button>
          </div>
        </Card>

        <div className="space-y-2">
          {owners.length === 0 && <p className="text-center text-gray-400 text-sm py-4">ยังไม่มีเจ้าของ</p>}
          {owners.map((o) => (
            <Card key={o.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{o.name}</p>
                  {o.phone && <p className="text-xs text-gray-400">{o.phone}</p>}
                </div>
                {o.linkedAt ? <Badge kind="paid">ผูกแล้ว</Badge> : <Badge kind="pending">รอผูก LINE</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="text-sm py-2" onClick={() => copy(o)}>
                  {copiedId === o.id ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}
                </Button>
                <Button variant="danger" className="text-sm py-2" onClick={() => remove(o)}>ลบ</Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
