import { Fragment, useEffect, useMemo, useState } from 'react'
import api from '../../lib/axios'
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
  subscriptionStatus?: string
  expiresAt?: string | null
  linkedAt?: string
  properties: OwnerProp[]
  inviteUrl: string
}
interface Property {
  id: string
  name: string
  ownerId?: string | null
  stats?: { total: number }
}

const field =
  'h-[42px] box-border border-[1.5px] border-line-input rounded-[10px] px-3 font-sans text-sm text-ink outline-none'

function badge(o: Owner) {
  if (o.subscriptionStatus === 'SUSPENDED') return { label: 'ระงับ', cls: 'bg-danger-bg text-danger' }
  if (o.subscriptionStatus === 'GRACE') return { label: 'ผ่อนผัน', cls: 'bg-warn-bg text-warn-fg' }
  const plan = (o.plan || 'TRIAL') as OwnerPlan
  if (plan === 'PERMANENT') return { label: 'ถาวร', cls: 'bg-admin-bg text-admin-fg' }
  if (plan === 'YEARLY') return { label: 'รายปี', cls: 'bg-ok-bg text-ok-fg' }
  if (plan === 'MONTHLY') return { label: 'รายเดือน', cls: 'bg-ok-bg text-ok-fg' }
  return { label: 'ทดลอง', cls: 'bg-info-bg text-info' }
}

function expiry(o: Owner) {
  if (o.plan === 'PERMANENT') return '—'
  if (o.subscriptionStatus === 'GRACE' && o.expiresAt) return `ผ่อนผันถึง ${thaiDate(o.expiresAt)}`
  if (o.subscriptionStatus === 'SUSPENDED' && o.expiresAt) return `ระงับ ${thaiDate(o.expiresAt)}`
  if (!o.expiresAt) return 'ยังไม่เริ่มนับ'
  return thaiDate(o.expiresAt)
}

export default function PortalOwners() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState<OwnerPlan>('TRIAL')
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string>()
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string; inviteUrl: string }>()
  const [error, setError] = useState<string>()
  const [note, setNote] = useState<string>()

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

  const stats = useMemo(() => {
    const bucket = { trial: 0, active: 0, grace: 0, sus: 0 }
    for (const o of owners) {
      if (o.subscriptionStatus === 'SUSPENDED') bucket.sus += 1
      else if (o.subscriptionStatus === 'GRACE') bucket.grace += 1
      else if ((o.plan || 'TRIAL') === 'TRIAL' || o.subscriptionStatus === 'TRIAL') bucket.trial += 1
      else bucket.active += 1
    }
    return bucket
  }, [owners])

  const shown = owners.filter((o) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return o.name.toLowerCase().includes(s) || (o.username || '').toLowerCase().includes(s)
  })

  const unassigned = properties.filter((p) => !p.ownerId)

  function roomsOf(o: Owner) {
    const ids = new Set(o.properties.map((p) => p.id))
    const rooms = properties.filter((p) => ids.has(p.id)).reduce((a, p) => a + (p.stats?.total || 0), 0)
    return `${o.properties.length} / ${rooms}`
  }

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
        plan,
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
      setPlan('TRIAL')
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
      /* keep existing url */
    }
    await navigator.clipboard.writeText(url)
    setNote('คัดลอกลิงก์ผูก LINE แล้ว')
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
    if (!confirm(`เปลี่ยนประเภทบัญชีของ ${o.name} เป็น "${OWNER_PLAN_LABEL[next]}" ?`)) return
    await api.put(`/owners/${o.id}`, { plan: next })
    await load()
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-display text-[28px] font-bold">เจ้าของ</h1>
          <span className="text-sm text-muted">
            {owners.length} บัญชี · ทดลอง {stats.trial} · ใช้งาน {stats.active} · ผ่อนผัน {stats.grace} · ระงับ {stats.sus}
          </span>
        </div>
        <label className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-line-input bg-white" style={{ flex: '0 1 300px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="ค้นหา"
            placeholder="ค้นหาชื่อ / username"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-0 border-0 outline-none font-sans text-sm bg-transparent"
          />
        </label>
      </header>

      {note && <p className="m-0 text-sm text-ok-fg">{note}</p>}

      <div className="flex flex-wrap gap-4 items-start">
        <section className="min-w-0 bg-white rounded-[18px] overflow-hidden" style={{ flex: '3 1 560px' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted text-[13px]">
                  <th className="px-4 py-3 border-b border-line-input font-semibold">เจ้าของ</th>
                  <th className="px-2 py-3 border-b border-line-input font-semibold">อาคาร / ห้อง</th>
                  <th className="px-2 py-3 border-b border-line-input font-semibold">แพ็กเกจ</th>
                  <th className="px-2 py-3 border-b border-line-input font-semibold">หมดอายุ</th>
                  <th className="px-2 py-3 border-b border-line-input font-semibold">LINE</th>
                  <th className="px-4 py-3 border-b border-line-input" />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const b = badge(o)
                  const open = openId === o.id
                  return (
                    <Fragment key={o.id}>
                      <tr>
                        <td className="px-4 py-3 border-b border-line-soft">
                          <div className="flex flex-col">
                            <strong>{o.name}</strong>
                            <span className="text-xs text-muted">{o.username || '—'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 border-b border-line-soft">{roomsOf(o)}</td>
                        <td className="px-2 py-3 border-b border-line-soft">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${b.cls}`}>{b.label}</span>
                        </td>
                        <td className="px-2 py-3 border-b border-line-soft text-muted">{expiry(o)}</td>
                        <td className="px-2 py-3 border-b border-line-soft text-muted">{o.linkedAt ? 'ผูกแล้ว' : 'ยังไม่ผูก'}</td>
                        <td className="px-4 py-3 border-b border-line-soft text-right">
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? undefined : o.id)}
                            className="h-[34px] px-3 border border-line-input rounded-lg bg-white font-sans text-[13px] font-semibold"
                          >
                            จัดการ
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 border-b border-line-soft bg-canvas">
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                className="h-9 border border-line-input rounded-lg px-2 text-sm bg-white"
                                value={o.plan || 'TRIAL'}
                                onChange={(e) => changePlan(o, e.target.value as OwnerPlan)}
                              >
                                {OWNER_PLAN_OPTIONS.map((p) => (
                                  <option key={p.value} value={p.value}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                              <button type="button" className="h-9 px-3 border border-line-input rounded-lg bg-white text-sm font-semibold" onClick={() => copyInvite(o)}>
                                คัดลอกลิงก์ LINE
                              </button>
                              <button type="button" className="h-9 px-3 border border-line-input rounded-lg bg-white text-sm font-semibold" onClick={() => resetPassword(o)}>
                                รีเซ็ตรหัส
                              </button>
                              <button type="button" className="h-9 px-3 rounded-lg bg-danger-bg text-danger text-sm font-semibold" onClick={() => remove(o)}>
                                ลบ
                              </button>
                              {unassigned.length > 0 && (
                                <select className="h-9 border border-line-input rounded-lg px-2 text-sm bg-white" value="" onChange={(e) => assign(o, e.target.value)}>
                                  <option value="">มอบหมายอาคาร</option>
                                  {unassigned.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {o.properties.map((p) => (
                                <button key={p.id} type="button" onClick={() => unassign(o, p.id)} className="text-xs bg-white border border-line-input rounded-full px-2.5 py-1">
                                  {p.name} ×
                                </button>
                              ))}
                              {o.properties.length === 0 && <span className="text-xs text-muted">ยังไม่มีอาคาร</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="p-8 text-center text-muted m-0">ไม่พบเจ้าของ</p>}
        </section>

        <aside aria-label="สร้างบัญชีเจ้าของ" className="min-w-0 bg-white rounded-[18px] p-5 flex flex-col gap-3" style={{ flex: '1 1 320px' }}>
          <strong className="font-display text-lg">สร้างบัญชีเจ้าของ</strong>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            ชื่อ
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            เบอร์โทร
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            Username ชั่วคราว
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            รหัสผ่าน (ว่างไว้ให้ระบบสุ่ม)
            <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            แพ็กเกจ
            <select className="h-[42px] border-[1.5px] border-line-input rounded-[10px] px-2.5 font-sans text-sm text-ink bg-white" value={plan} onChange={(e) => setPlan(e.target.value as OwnerPlan)}>
              {OWNER_PLAN_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.hint}
                </option>
              ))}
            </select>
          </label>
          {createdCreds && (
            <div className="bg-ok-bg rounded-xl p-3 flex flex-col gap-1.5">
              <span className="text-xs font-bold text-ok-fg">หลังสร้าง ส่งให้เจ้าของ</span>
              <span className="text-[13px]">
                Username: <strong>{createdCreds.username}</strong>
              </span>
              <span className="text-[13px]">
                รหัสชั่วคราว: <strong>{createdCreds.password}</strong> (บังคับเปลี่ยนเมื่อเข้าใช้)
              </span>
              <span className="text-[13px]">
                ลิงก์ผูก LINE:{' '}
                <button
                  type="button"
                  className="font-bold text-primary bg-transparent border-0 p-0"
                  onClick={() => navigator.clipboard.writeText(createdCreds.inviteUrl).then(() => setNote('คัดลอกลิงก์ผูก LINE แล้ว'))}
                >
                  คัดลอก
                </button>
              </span>
            </div>
          )}
          {error && <p className="m-0 text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={add}
            disabled={saving || !name.trim() || !username.trim()}
            className="h-11 border-0 rounded-[10px] bg-primary text-white font-sans text-[15px] font-bold disabled:opacity-50"
          >
            {saving ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
          </button>
        </aside>
      </div>
    </div>
  )
}
