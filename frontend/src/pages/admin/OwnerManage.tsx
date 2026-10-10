import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Button, Card, Badge, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { OWNER_PLAN_LABEL, OWNER_PLAN_OPTIONS, OwnerPlan } from '../../lib/ownerPlan'
import { thaiDate } from '../../lib/utils'

interface OwnerProp {
  id: string
  name: string
}
interface Owner {
  id: string
  name: string
  phone?: string
  username?: string
  plan?: OwnerPlan
  expiresAt?: string | null
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
  const [username, setUsername] = useState('')
  const [plan, setPlan] = useState<OwnerPlan>('TRIAL')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string>()
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string; inviteUrl: string; name: string }>()
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
        username: username.trim(),
        plan,
      })
      setCreatedCreds({
        username: data.username,
        password: data.temporaryPassword,
        inviteUrl: data.inviteUrl,
        name: name.trim(),
      })
      setName('')
      setUsername('')
      setPlan('TRIAL')
      await load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'สร้างไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function inviteUrlFor(o: Owner) {
    try {
      const { data } = await api.get(`/owners/${o.id}/invite-link`)
      return data.inviteUrl as string
    } catch {
      return o.inviteUrl
    }
  }

  async function shareInvite(o: Owner) {
    const url = await inviteUrlFor(o)
    const text = `คำเชิญเจ้าของ PropFlow — ${o.name}\nกดลิงก์ใน LINE เพื่อผูกบัญชีและเปิดเมนูผู้ดูแล`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'คำเชิญเจ้าของ', text, url })
        return
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(url)
    setCopiedId(o.id)
    setTimeout(() => setCopiedId(undefined), 1500)
  }

  async function shareCreated() {
    if (!createdCreds) return
    const portalUrl = `${window.location.origin}/portal/login`
    const text = `PropFlow — บัญชีเจ้าของ\nPortal: ${portalUrl}\nUsername: ${createdCreds.username}\nPassword: ${createdCreds.password}\n\nลิงก์ผูก LINE (กดใน LINE):\n${createdCreds.inviteUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'บัญชีเจ้าของ', text })
        return
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(text)
    setCopiedId('created')
    setTimeout(() => setCopiedId(undefined), 1500)
  }

  async function resetPassword(o: Owner) {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${o.name}?`)) return
    const { data } = await api.post(`/owners/${o.id}/reset-password`)
    setCreatedCreds({
      username: data.username,
      password: data.temporaryPassword,
      inviteUrl: o.inviteUrl,
      name: o.name,
    })
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

  async function changePlan(o: Owner, next: OwnerPlan) {
    if (!next || next === o.plan) return
    if (!confirm(`เปลี่ยนเป็น "${OWNER_PLAN_LABEL[next]}" ?`)) return
    await api.put(`/owners/${o.id}`, { plan: next })
    await load()
  }

  const unassigned = properties.filter((p) => !p.ownerId)

  return (
    <div>
      <TopBar title="จัดการเจ้าของ" />
      <div className="p-4 space-y-3">
        {createdCreds && (
          <Card className="space-y-3 text-center">
            <Badge kind="paid">สร้างแล้ว</Badge>
            <div>
              <p className="font-semibold">{createdCreds.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                {createdCreds.username} · {createdCreds.password}
              </p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              ส่งลิงก์ผูก LINE ให้เจ้าของ — กดแล้วเปิดเมนูผู้ดูแลอัตโนมัติ
            </p>
            <Button onClick={shareCreated}>
              {copiedId === 'created' ? 'คัดลอกแล้ว' : 'ส่งลิงก์ + รหัสให้เจ้าของ'}
            </Button>
            <button type="button" className="text-xs text-gray-400" onClick={() => setCreatedCreds(undefined)}>
              ปิด
            </button>
          </Card>
        )}

        <Card className="space-y-3">
          <h3 className="font-semibold">เพิ่มเจ้าของ</h3>
          <Input label="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณสมชาย" />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="somchai" />
          <label className="block">
            <span className="block text-sm font-medium text-gray-600 mb-1">ประเภทบัญชี</span>
            <select
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              value={plan}
              onChange={(e) => setPlan(e.target.value as OwnerPlan)}
            >
              {OWNER_PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={add} disabled={saving || !name.trim() || !username.trim()}>
            {saving ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
          </Button>
        </Card>

        <div className="space-y-2">
          {owners.length === 0 && <p className="text-center text-gray-400 text-sm py-6">ยังไม่มีเจ้าของ</p>}
          {owners.map((o) => (
            <Card key={o.id} className="space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{o.name}</p>
                  <p className="text-xs text-gray-400">@{o.username || '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {OWNER_PLAN_LABEL[(o.plan || 'TRIAL') as OwnerPlan]}
                    {o.plan === 'PERMANENT'
                      ? ''
                      : o.expiresAt
                        ? ` · ${thaiDate(o.expiresAt)}`
                        : ' · ยังไม่เริ่ม'}
                  </p>
                </div>
                {o.linkedAt ? <Badge kind="paid">ผูกแล้ว</Badge> : <Badge kind="pending">รอผูก LINE</Badge>}
              </div>

              {!o.linkedAt && (
                <Button onClick={() => shareInvite(o)}>
                  {copiedId === o.id ? 'คัดลอกแล้ว' : 'ส่งลิงก์เชิญ'}
                </Button>
              )}

              <div className="flex flex-wrap gap-1">
                {o.properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => unassign(o, p.id)}
                    className="text-xs bg-gray-100 rounded-full px-2.5 py-1"
                  >
                    {p.name} ✕
                  </button>
                ))}
              </div>
              {unassigned.length > 0 && (
                <select
                  className="w-full border rounded-xl p-2.5 text-sm"
                  value=""
                  onChange={(e) => assign(o, e.target.value)}
                >
                  <option value="">+ มอบหมายอาคาร</option>
                  {unassigned.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <details className="text-sm">
                <summary className="text-gray-400 cursor-pointer py-1">จัดการเพิ่มเติม</summary>
                <div className="space-y-2 mt-2">
                  <select
                    className="w-full border rounded-xl p-2 text-sm"
                    value={o.plan || 'TRIAL'}
                    onChange={(e) => changePlan(o, e.target.value as OwnerPlan)}
                  >
                    {OWNER_PLAN_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" className="text-sm py-2" onClick={() => resetPassword(o)}>
                      รีเซ็ตรหัส
                    </Button>
                    <Button variant="danger" className="text-sm py-2" onClick={() => remove(o)}>
                      ลบ
                    </Button>
                  </div>
                </div>
              </details>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
