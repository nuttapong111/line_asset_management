import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { OWNER_PLAN_LABEL, OWNER_PLAN_OPTIONS, OwnerPlan } from '../../lib/ownerPlan'
import { cls } from '../../lib/utils'

interface OwnerProp { id: string; name: string }
interface Owner {
  id: string
  name: string
  phone?: string
  username?: string
  plan?: OwnerPlan
  subscriptionStatus?: string
  expiresAt?: string | null
  linkedAt?: string
  mustChangePassword?: boolean
  properties: OwnerProp[]
  inviteUrl: string
}
interface Property { id: string; name: string; ownerId?: string | null }

const TAG: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'ทดลอง', cls: 'bg-info-bg text-info' },
  MONTHLY: { label: 'รายเดือน', cls: 'bg-ok-bg text-ok-fg' },
  YEARLY: { label: 'รายปี', cls: 'bg-ok-bg text-ok-fg' },
  PERMANENT: { label: 'ถาวร', cls: 'bg-admin-bg text-admin-fg' },
  GRACE: { label: 'ผ่อนผัน', cls: 'bg-warn-bg text-warn-fg' },
  SUSPENDED: { label: 'ระงับ', cls: 'bg-danger-bg text-danger' },
}

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] bg-white'

export default function OwnerManage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string>()
  const [creating, setCreating] = useState(false)
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
    try {
      const { data } = await api.post('/owners', { name: name.trim(), username: username.trim(), plan })
      setCreatedCreds({
        username: data.username,
        password: data.temporaryPassword,
        inviteUrl: data.inviteUrl,
        name: name.trim(),
      })
      setName('')
      setUsername('')
      setPlan('TRIAL')
      setCreating(false)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'สร้างไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function shareInvite(o: Owner) {
    let url = o.inviteUrl
    try {
      const { data } = await api.get(`/owners/${o.id}/invite-link`)
      url = data.inviteUrl
    } catch {
      /* keep */
    }
    const text = `คำเชิญเจ้าของ PropFlow — ${o.name}\n${url}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'คำเชิญเจ้าของ', text })
        return
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(url)
    setCopiedId(o.id)
    setTimeout(() => setCopiedId(undefined), 1500)
  }

  async function resetPassword(o: Owner) {
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${o.name}?`)) return
    const { data } = await api.post(`/owners/${o.id}/reset-password`)
    let inviteUrl = o.inviteUrl
    try {
      const link = await api.get(`/owners/${o.id}/invite-link`)
      inviteUrl = link.data.inviteUrl
    } catch {
      /* keep */
    }
    setCreatedCreds({ username: data.username, password: data.temporaryPassword, inviteUrl, name: o.name })
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
  const filtered = owners.filter((o) => {
    const hay = `${o.name} ${o.username || ''}`.toLowerCase()
    return hay.includes(q.trim().toLowerCase())
  })

  function lineLabel(o: Owner) {
    if (o.linkedAt) return 'ผูก LINE แล้ว'
    if (o.mustChangePassword) return 'ยังไม่เข้าใช้ครั้งแรก'
    return 'ยังไม่ผูก LINE'
  }

  function tagOf(o: Owner) {
    if (o.subscriptionStatus === 'GRACE') return TAG.GRACE
    if (o.subscriptionStatus === 'SUSPENDED') return TAG.SUSPENDED
    return TAG[o.plan || 'TRIAL'] || TAG.TRIAL
  }

  return (
    <div className="pb-28 relative">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <h1 className="m-0 font-display text-[26px] font-bold">เจ้าของ</h1>
        <label className="flex items-center gap-2 h-11 px-3 rounded-button border border-line-soft bg-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input aria-label="ค้นหาเจ้าของ" placeholder="ชื่อ หรือ username" className="flex-1 min-w-0 border-0 outline-none text-[15px] bg-transparent" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>

        {createdCreds && (
          <section className="bg-white rounded-card p-3.5 flex flex-col gap-1 text-sm">
            <strong>สร้างบัญชี {createdCreds.name}</strong>
            <span className="text-muted">username {createdCreds.username}</span>
            <span className="text-muted">รหัสชั่วคราว {createdCreds.password}</span>
            <span className="text-xs break-all text-primary">{createdCreds.inviteUrl}</span>
            <button type="button" className="self-start text-sm font-bold text-primary" onClick={() => setCreatedCreds(undefined)}>ปิด</button>
          </section>
        )}

        <div className="bg-white rounded-card overflow-hidden">
          {filtered.length === 0 && <p className="px-3.5 py-6 text-sm text-muted text-center">ยังไม่มีเจ้าของ</p>}
          {filtered.map((o) => {
            const tag = tagOf(o)
            const open = openId === o.id
            return (
              <div key={o.id} className="border-b border-line-soft">
                <button type="button" className="w-full px-3.5 py-3 flex items-center gap-3 text-left" onClick={() => setOpenId(open ? undefined : o.id)}>
                  <span className="w-10 h-10 rounded-full bg-surface-2 font-bold flex items-center justify-center">{o.name.replace(/^คุณ/, '').slice(0, 1)}</span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-[15px] truncate">{o.name}</strong>
                    <span className="text-xs text-muted truncate">{o.username || '—'} · {o.properties.length} อาคาร</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5">
                    <span className={cls('px-2.5 py-0.5 rounded-full text-xs font-bold', tag.cls)}>{tag.label}</span>
                    <span className="text-[11px] text-muted">{lineLabel(o)}</span>
                  </span>
                </button>
                {open && (
                  <div className="px-3.5 pb-3 flex flex-col gap-2">
                    <button type="button" className="text-sm font-bold text-primary text-left" onClick={() => shareInvite(o)}>
                      {copiedId === o.id ? 'คัดลอกลิงก์แล้ว' : 'ส่งลิงก์เชิญ'}
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {o.properties.map((p) => (
                        <button key={p.id} type="button" className="text-xs bg-surface-2 rounded-full px-2.5 py-1" onClick={() => unassign(o, p.id)}>
                          {p.name} ✕
                        </button>
                      ))}
                    </div>
                    {unassigned.length > 0 && (
                      <select aria-label="มอบหมายอาคาร" className={fieldCls} value="" onChange={(e) => assign(o, e.target.value)}>
                        <option value="">+ มอบหมายอาคาร</option>
                        {unassigned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}
                    <select aria-label="ประเภทบัญชี" className={fieldCls} value={o.plan || 'TRIAL'} onChange={(e) => changePlan(o, e.target.value as OwnerPlan)}>
                      {OWNER_PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="h-11 rounded-button border-[1.5px] border-primary text-primary text-sm font-bold" onClick={() => resetPassword(o)}>รีเซ็ตรหัส</button>
                      <button type="button" className="h-11 rounded-button bg-danger-bg text-danger text-sm font-bold" onClick={() => remove(o)}>ลบ</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-30 bg-ink/40 flex items-end" onClick={() => setCreating(false)}>
          <form
            className="w-full max-w-liff mx-auto bg-white rounded-t-[20px] p-4 pb-8 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <strong className="font-display text-lg">สร้างบัญชีเจ้าของ</strong>
            <label className="text-[13px] font-semibold text-muted flex flex-col gap-1">
              ชื่อ
              <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-[13px] font-semibold text-muted flex flex-col gap-1">
              Username
              <input className={fieldCls} value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="text-[13px] font-semibold text-muted flex flex-col gap-1">
              ประเภทบัญชี
              <select className={fieldCls} value={plan} onChange={(e) => setPlan(e.target.value as OwnerPlan)}>
                {OWNER_PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button type="submit" className="h-[52px] rounded-cta bg-primary text-white font-bold disabled:opacity-50" disabled={saving || !name.trim() || !username.trim()}>
              {saving ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="fixed right-4 bottom-[98px] z-20 h-[52px] px-5 rounded-full bg-primary text-white text-base font-bold shadow-fab"
        onClick={() => setCreating(true)}
      >
        + สร้างบัญชีเจ้าของ
      </button>
      <BottomNav role="ADMIN" />
    </div>
  )
}
