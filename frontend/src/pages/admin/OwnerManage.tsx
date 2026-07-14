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
  username?: string
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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string>()
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string; inviteUrl: string }>()
  const [error, setError] = useState<string>()

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
    if (!name.trim() || !username.trim()) return
    setSaving(true)
    setError(undefined)
    setCreatedCreds(undefined)
    try {
      const { data } = await api.post('/owners', {
        name: name.trim(),
        phone: phone.trim() || undefined,
        username: username.trim(),
        password: password.trim() || undefined,
      })
      setCreatedCreds({
        username: data.username,
        password: data.temporaryPassword,
        inviteUrl: data.inviteUrl,
      })
      setName('')
      setPhone('')
      setUsername('')
      setPassword('')
      await load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'สร้างไม่สำเร็จ')
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
      /* fall back */
    }
    navigator.clipboard.writeText(url)
    setCopiedId(o.id)
    setTimeout(() => setCopiedId(undefined), 1500)
  }

  async function resetPassword(o: Owner) {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${o.name}?`)) return
    const { data } = await api.post(`/owners/${o.id}/reset-password`)
    setCreatedCreds({
      username: data.username,
      password: data.temporaryPassword,
      inviteUrl: o.inviteUrl,
    })
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
  const portalUrl = `${window.location.origin}/portal/login`

  return (
    <div>
      <TopBar title="จัดการเจ้าของ" />
      <div className="p-4 space-y-4">
        <div className="bg-line-light rounded-xl p-3 text-sm text-line-dark">
          สร้าง Username/Password สำหรับเข้าเว็บ Portal และส่งลิงก์ผูก LINE แยก — อย่าส่งรหัสผ่านในแชทกลุ่ม
        </div>

        {createdCreds && (
          <Card className="bg-white space-y-2 text-sm">
            <p className="font-semibold text-line-dark">ส่งให้เจ้าของ</p>
            <p>
              Portal: <span className="break-all">{portalUrl}</span>
            </p>
            <p>
              Username: <code>{createdCreds.username}</code>
            </p>
            <p>
              Password: <code>{createdCreds.password}</code>
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                navigator.clipboard.writeText(
                  `Portal: ${portalUrl}\nUsername: ${createdCreds.username}\nPassword: ${createdCreds.password}\nลิงก์ผูก LINE: ${createdCreds.inviteUrl}`
                )
              }
            >
              คัดลอกข้อความทั้งหมด
            </Button>
          </Card>
        )}

        <Card>
          <h3 className="font-semibold mb-2">เพิ่มเจ้าของ</h3>
          <div className="space-y-2">
            <Input label="ชื่อเจ้าของ" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณสมชาย" />
            <Input label="เบอร์โทร (ไม่บังคับ)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="somchai" />
            <Input
              label="Password (ว่าง = สุ่ม)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button onClick={add} disabled={saving || !name.trim() || !username.trim()}>
              {saving ? 'กำลังบันทึก...' : 'สร้างบัญชี'}
            </Button>
          </div>
        </Card>

        <div className="space-y-2">
          {owners.length === 0 && <p className="text-center text-gray-400 text-sm py-4">ยังไม่มีเจ้าของ</p>}
          {owners.map((o) => (
            <Card key={o.id}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-gray-400">@{o.username || '—'}{o.phone ? ` · ${o.phone}` : ''}</p>
                </div>
                {o.linkedAt ? <Badge kind="paid">ผูก LINE แล้ว</Badge> : <Badge kind="pending">รอผูก LINE</Badge>}
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
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="text-sm py-2" onClick={() => copy(o)}>
                  {copiedId === o.id ? 'คัดลอกแล้ว ✓' : 'ลิงก์ผูก LINE'}
                </Button>
                <Button variant="secondary" className="text-sm py-2" onClick={() => resetPassword(o)}>
                  รีเซ็ตรหัส
                </Button>
                <Button variant="danger" className="text-sm py-2 col-span-2" onClick={() => remove(o)}>
                  ลบ
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
