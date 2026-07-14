import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Button, Input } from '../../components/ui'

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

export default function PortalOwners() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
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

  async function resetPassword(o: Owner) {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${o.name}?`)) return
    const { data } = await api.post(`/owners/${o.id}/reset-password`)
    setCreatedCreds({
      username: data.username,
      password: data.temporaryPassword,
      inviteUrl: o.inviteUrl,
    })
  }

  async function copyInvite(o: Owner) {
    let url = o.inviteUrl
    try {
      const { data } = await api.get(`/owners/${o.id}/invite-link`)
      url = data.inviteUrl
    } catch {
      /* */
    }
    await navigator.clipboard.writeText(url)
    alert('คัดลอกลิงก์ผูก LINE แล้ว')
  }

  async function remove(o: Owner) {
    if (!confirm(`ลบเจ้าของ "${o.name}" ?`)) return
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">จัดการเจ้าของ</h1>
        <p className="text-sm text-gray-500 mt-1">
          สร้าง Username/Password สำหรับเข้า Portal และส่งลิงก์ผูก LINE แยกต่างหาก
        </p>
      </div>

      {createdCreds && (
        <div className="bg-line-light border border-line/20 rounded-xl p-4 text-sm space-y-2">
          <div className="font-semibold text-line-dark">ส่งข้อมูลนี้ให้เจ้าของ (อย่าส่งรหัสผ่านในแชทสาธารณะ)</div>
          <div>
            Username: <code className="bg-white px-1 rounded">{createdCreds.username}</code>
          </div>
          <div>
            Password ชั่วคราว: <code className="bg-white px-1 rounded">{createdCreds.password}</code>
          </div>
          <div className="break-all">
            ลิงก์ผูก LINE:{' '}
            <a className="text-line underline" href={createdCreds.inviteUrl} target="_blank" rel="noreferrer">
              {createdCreds.inviteUrl}
            </a>
          </div>
          <Button
            variant="secondary"
            className="!w-auto"
            onClick={() =>
              navigator.clipboard.writeText(
                `Portal: ${window.location.origin}/portal/login\nUsername: ${createdCreds.username}\nPassword: ${createdCreds.password}\nลิงก์ผูก LINE: ${createdCreds.inviteUrl}`
              )
            }
          >
            คัดลอกข้อความทั้งหมด
          </Button>
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 max-w-xl">
        <h2 className="font-semibold">เพิ่มเจ้าของ</h2>
        <Input label="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input
          label="Password (ว่างไว้ให้ระบบสุ่ม)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={add} disabled={saving || !name.trim() || !username.trim()}>
          {saving ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
        </Button>
      </section>

      <div className="space-y-3">
        {owners.map((o) => (
          <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex flex-wrap justify-between gap-2 mb-2">
              <div>
                <div className="font-semibold">{o.name}</div>
                <div className="text-xs text-gray-400">
                  @{o.username || '—'} · {o.phone || 'ไม่มีเบอร์'} · {o.linkedAt ? 'ผูก LINE แล้ว' : 'ยังไม่ผูก LINE'}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="!w-auto text-sm py-1.5 px-3" onClick={() => copyInvite(o)}>
                  คัดลอกลิงก์ LINE
                </Button>
                <Button variant="secondary" className="!w-auto text-sm py-1.5 px-3" onClick={() => resetPassword(o)}>
                  รีเซ็ตรหัส
                </Button>
                <Button variant="danger" className="!w-auto text-sm py-1.5 px-3" onClick={() => remove(o)}>
                  ลบ
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {o.properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => unassign(o, p.id)}
                  className="text-xs bg-gray-100 rounded-full px-2 py-1"
                >
                  {p.name} ✕
                </button>
              ))}
            </div>
            {unassigned.length > 0 && (
              <select
                className="w-full md:w-64 border rounded-lg p-2 text-sm"
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
        ))}
      </div>
    </div>
  )
}
