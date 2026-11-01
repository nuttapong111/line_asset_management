import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { AuthImage } from '../../components/AuthImage'
import { thaiDate } from '../../lib/utils'

interface PropertyRow {
  id: string
  name: string
  bankName?: string | null
  bankAccount?: string | null
  promptpayNumber: string
  paymentQrUrl?: string | null
}

const field =
  'h-11 box-border border-[1.5px] border-line-input rounded-[10px] px-3 font-sans text-[15px] text-ink outline-none focus:border-primary'

export default function PortalSettings() {
  const { user, role, setAuth, mustChangePassword } = useAuthStore()
  const isOwner = role === 'OWNER'
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [propsList, setPropsList] = useState<PropertyRow[]>([])
  const [propId, setPropId] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [promptpay, setPromptpay] = useState('')
  const [qrTick, setQrTick] = useState(0)
  const [subLabel, setSubLabel] = useState<string>()
  const [msg, setMsg] = useState<string>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)

  function applyProperty(p: PropertyRow) {
    setPropId(p.id)
    setBankName(p.bankName || '')
    setBankAccount(p.bankAccount || '')
    setPromptpay(p.promptpayNumber || '')
  }

  function loadProperties() {
    api
      .get('/properties')
      .then((r) => {
        const list = r.data as PropertyRow[]
        setPropsList(list)
        if (list[0]) applyProperty(list.find((p) => p.id === propId) || list[0])
      })
      .catch(() => {})
  }

  useEffect(() => {
    api
      .get('/auth/me')
      .then((r) => {
        if (r.data.user) {
          setAuth(useAuthStore.getState().jwt!, r.data.role, r.data.user, {
            adminId: r.data.adminId,
            ownerId: r.data.ownerId,
            mustChangePassword: r.data.mustChangePassword,
            authSource: 'portal',
          })
          setUsername(r.data.user.username || '')
        }
      })
      .catch(() => {})
    loadProperties()
    if (isOwner) {
      api
        .get('/subscriptions/me')
        .then((r) => {
          const o = r.data.owner
          if (o.permanent || o.plan === 'PERMANENT') setSubLabel('ถาวร')
          else if (o.subscriptionStatus === 'TRIAL') setSubLabel(`ทดลอง เหลือ ${o.daysLeft ?? '—'} วัน`)
          else if (o.subscriptionStatus === 'GRACE') setSubLabel('ผ่อนผัน')
          else if (o.subscriptionStatus === 'SUSPENDED') setSubLabel('ระงับ')
          else setSubLabel(o.expiresAt ? `หมด ${thaiDate(o.expiresAt)}` : 'ใช้งานอยู่')
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner])

  const current = propsList.find((p) => p.id === propId)

  async function save(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    setMsg(undefined)
    try {
      if (newPassword) {
        if (newPassword.length < 6) {
          setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
          setLoading(false)
          return
        }
        const { data } = await api.post('/auth/password', {
          username: username || undefined,
          currentPassword: user?.hasPassword ? currentPassword : undefined,
          newPassword,
        })
        setAuth(data.token, data.role, data.user, {
          adminId: data.adminId,
          ownerId: data.ownerId,
          mustChangePassword: false,
          authSource: 'portal',
        })
        setCurrentPassword('')
        setNewPassword('')
      }
      if (propId) {
        if (!promptpay.trim()) {
          setError('เลข PromptPay จำเป็นสำหรับอาคาร')
          setLoading(false)
          return
        }
        await api.put(`/properties/${propId}`, {
          bankName: bankName.trim() || undefined,
          bankAccount: bankAccount.trim() || undefined,
          promptpayNumber: promptpay.trim(),
        })
        loadProperties()
      }
      setMsg('บันทึกการเปลี่ยนแปลงแล้ว')
    } catch (err: any) {
      const raw = err.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'บันทึกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function uploadQr(file: File) {
    if (!propId) return
    setQrBusy(true)
    setError(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/properties/${propId}/payment-qr`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setQrTick((n) => n + 1)
      loadProperties()
    } catch (err: any) {
      setError(err.response?.data?.error || 'อัปโหลด QR ไม่สำเร็จ')
    } finally {
      setQrBusy(false)
    }
  }

  async function removeQr() {
    if (!propId) return
    setQrBusy(true)
    try {
      await api.delete(`/properties/${propId}/payment-qr`)
      setQrTick((n) => n + 1)
      loadProperties()
    } finally {
      setQrBusy(false)
    }
  }

  return (
    <form id="portal-settings" onSubmit={save} className="flex flex-col gap-5">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <h1 className="m-0 font-display text-[28px] font-bold">ตั้งค่าบัญชี</h1>
        <button type="submit" disabled={loading} className="h-11 px-5 border-0 rounded-[10px] bg-primary text-white font-sans text-[15px] font-bold disabled:opacity-50">
          {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </header>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}
      {msg && <p className="m-0 text-sm text-ok-fg">{msg}</p>}

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5">
          <h2 className="m-0 font-display text-lg font-semibold">ข้อมูลส่วนตัว</h2>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            ชื่อที่แสดงกับผู้เช่า
            <input className={`${field} bg-canvas`} value={user?.name || ''} readOnly />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            Username
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <div className={`flex justify-between items-center px-3.5 py-3 rounded-xl ${user?.lineLinked ? 'bg-ok-bg' : 'bg-warn-bg'}`}>
            <span className="text-sm">
              <strong>LINE</strong> {user?.lineLinked ? 'ผูกแล้ว · รับแจ้งเตือนสลิปและแจ้งซ่อม' : 'ยังไม่ผูก'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">รหัสผ่าน Portal</span>
            <button type="button" onClick={() => setShowPw((v) => !v)} className="h-9 px-3.5 border-[1.5px] border-line-input rounded-[10px] bg-white font-sans text-sm font-semibold">
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
          {mustChangePassword && (
            <p className="m-0 text-sm text-warn-fg">
              ต้องเปลี่ยนรหัสผ่านก่อน —{' '}
              <Link to="/portal/change-password" className="underline font-semibold">
                ไปหน้าเปลี่ยนรหัส
              </Link>
            </p>
          )}
          {showPw && (
            <div className="flex flex-col gap-3">
              {user?.hasPassword && (
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                  รหัสผ่านปัจจุบัน
                  <input className={field} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                </label>
              )}
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                รหัสผ่านใหม่
                <input className={field} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร" />
              </label>
            </div>
          )}
          <p className="m-0 text-xs text-muted">{role === 'ADMIN' ? 'ผู้ดูแลแพลตฟอร์ม' : 'เจ้าของทรัพย์สิน'}</p>
        </section>

        <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5">
          <div className="flex justify-between items-baseline gap-3">
            <h2 className="m-0 font-display text-lg font-semibold">การรับเงิน{current ? ` · ${current.name}` : ''}</h2>
            {propsList.length > 1 && (
              <select
                aria-label="อาคารอื่น"
                className="text-[13px] font-bold text-primary bg-transparent border-0"
                value={propId}
                onChange={(e) => {
                  const p = propsList.find((x) => x.id === e.target.value)
                  if (p) applyProperty(p)
                }}
              >
                {propsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!current && <p className="m-0 text-sm text-muted">ยังไม่มีอาคาร</p>}
          {current && (
            <>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                เลข PromptPay (บังคับ)
                <input className={field} value={promptpay} onChange={(e) => setPromptpay(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                  ธนาคาร
                  <input className={field} value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                  เลขบัญชี
                  <input className={field} value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
                </label>
              </div>
              <div className="flex gap-3.5 items-center p-3 border-[1.5px] border-dashed border-placeholder rounded-xl">
                {current.paymentQrUrl ? (
                  <AuthImage key={`${propId}-${qrTick}`} path={`/properties/${propId}/payment-qr`} alt="รูป QR ที่อัปโหลด" className="w-[72px] h-[72px] object-contain rounded-lg bg-surface-2" />
                ) : (
                  <div role="img" aria-label="ยังไม่มีรูป QR" className="w-[72px] h-[72px] rounded-lg bg-surface-2 flex items-center justify-center text-[11px] text-muted">
                    QR
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-0.5">
                  <strong className="text-sm">รูป QR รับเงินของอาคาร</strong>
                  <span className="text-xs text-muted">ใช้แทน QR ที่สร้างจากเลข PromptPay</span>
                </div>
                {current.paymentQrUrl ? (
                  <button type="button" onClick={removeQr} disabled={qrBusy} className="h-9 px-3 border-0 bg-transparent text-danger font-sans text-sm font-bold">
                    ลบ
                  </button>
                ) : (
                  <label className="h-9 px-3 flex items-center text-primary text-sm font-bold cursor-pointer">
                    {qrBusy ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadQr(f)
                      }}
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </section>

        <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-2.5">
          <h2 className="m-0 font-display text-lg font-semibold">อัตโนมัติ</h2>
          <Link to="/admin/notifications" className="h-12 border-b border-line-soft no-underline text-ink flex items-center justify-between text-[15px]">
            การแจ้งเตือนและเวลาส่งบิล
          </Link>
          <Link to="/admin/document-templates" className="h-12 border-b border-line-soft no-underline text-ink flex items-center justify-between text-[15px]">
            เทมเพลตสัญญาและใบเสร็จ
          </Link>
          {isOwner && (
            <Link to="/portal/subscription" className="h-12 no-underline text-ink flex items-center justify-between text-[15px]">
              ค่าบริการ PropFlow
              {subLabel && <span className="text-[13px] text-warn-fg font-bold">{subLabel}</span>}
            </Link>
          )}
        </section>
      </div>
    </form>
  )
}
