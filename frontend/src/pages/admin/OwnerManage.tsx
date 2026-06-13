import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Button, Card, Badge, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

interface OwnerProp {
  id: string
  name: string
}
interface Owner {
  id: string
  name: string
  phone?: string
  linkedAt?: string
  properties: OwnerProp[]
  inviteUrl: string
}
interface Property {
  id: string
  name: string
  ownerId?: string | null
}

export default function OwnerManage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string>()

  const load = () =>
    Promise.all([api.get('/owners'), api.get('/properties')])
      .then(([o, p]) => {
        setOwners(o.data)
        setProperties(p.data)
      })
      .catch(() => {})

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/owners', { name: name.trim(), phone: phone.trim() || undefined })
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
    if (!confirm(`ลบเจ้าของ "${o.name}" ? ทรัพย์สินที่มอบหมายจะถูกปลดออก`)) return
    await api.delete(`/owners/${o.id}`)
    await load()
  }

  async function assign(o: Owner, propertyId: string) {
    if (!propertyId) return
    await api.post(`/owners/${o.id}/properties`, { propertyId })
    await load()
  }

  async function unassign(o: Owner, propertyId: string) {
    await api.delete(`/owners/${o.id}/properties/${propertyId}`)
    await load()
  }

  const unassigned = properties.filter((p) => !p.ownerId)

  return (
    <div>
      <TopBar title="จัดการเจ้าของ" />
      <div className="p-4 space-y-4">
        <div className="bg-line-light rounded-xl p-3 text-sm text-line-dark">
          เจ้าของจะจัดการทรัพย์สินที่ได้รับมอบหมายได้เหมือนแอดมิน (เพิ่มห้อง ผู้เช่า ออกบิล ตรวจสลิป) และรับแจ้งเตือนทาง LINE
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

              <div className="mb-2">
                <p className="text-xs text-gray-400 mb-1">ทรัพย์สินที่มอบหมาย</p>
                {o.properties.length === 0 && <p className="text-xs text-gray-400">— ยังไม่มี —</p>}
                <div className="flex flex-wrap gap-1">
                  {o.properties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => unassign(o, p.id)}
                      className="text-xs bg-gray-100 rounded-full px-2 py-1"
                      title="แตะเพื่อปลดออก"
                    >
                      {p.name} ✕
                    </button>
                  ))}
                </div>
                {unassigned.length > 0 && (
                  <select
                    className="mt-2 w-full border rounded-lg p-2 text-sm"
                    value=""
                    onChange={(e) => assign(o, e.target.value)}
                  >
                    <option value="">+ มอบหมายทรัพย์สิน...</option>
                    {unassigned.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="text-sm py-2" onClick={() => copy(o)}>
                  {copiedId === o.id ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์เชิญ'}
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
