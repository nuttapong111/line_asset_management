import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/axios'
import { baht, thaiDate } from '../../lib/utils'
import { OWNER_PLAN_LABEL, OwnerPlan } from '../../lib/ownerPlan'

interface SubMe {
  owner: {
    plan?: OwnerPlan
    subscriptionStatus: string
    expiresAt?: string
    daysLeft: number | null
    permanent?: boolean
  }
  bill: { amount: number } | null
}

const STATUS: Record<string, string> = {
  TRIAL: 'ทดลองใช้',
  ACTIVE: 'ใช้งานอยู่',
  GRACE: 'ผ่อนผัน',
  SUSPENDED: 'ระงับ',
}

export default function Settings() {
  const nav = useNavigate()
  const { user, role, setAuth, clearAuth } = useAuth()
  const isAdmin = role === 'ADMIN'
  const navRole = role === 'OWNER' ? 'OWNER' : 'ADMIN'
  const [sub, setSub] = useState<SubMe>()
  const [propCount, setPropCount] = useState<number>()
  const [showPwd, setShowPwd] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState<string>()
  const [pwdError, setPwdError] = useState<string>()
  const [pwdLoading, setPwdLoading] = useState(false)
  const [richMsg, setRichMsg] = useState<string>()
  const [richLoading, setRichLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<string>()

  useEffect(() => {
    if (!isAdmin) {
      api.get('/subscriptions/me').then((r) => setSub(r.data)).catch(() => {})
      api.get('/properties').then((r) => setPropCount(r.data.length)).catch(() => {})
    }
  }, [isAdmin])

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwdLoading(true)
    setPwdError(undefined)
    setPwdMsg(undefined)
    try {
      const { data } = await api.post('/auth/password', {
        username: username || undefined,
        currentPassword: user?.hasPassword ? currentPassword : undefined,
        newPassword,
      })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: false,
        authSource: useAuthStore.getState().authSource || 'liff',
        unitId: useAuthStore.getState().unitId,
      })
      setCurrentPassword('')
      setNewPassword('')
      setPwdMsg('บันทึกแล้ว')
      setShowPwd(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setPwdError(typeof msg === 'string' ? msg : 'บันทึกไม่สำเร็จ')
    } finally {
      setPwdLoading(false)
    }
  }

  async function setupRichMenu() {
    setRichLoading(true)
    setRichMsg(undefined)
    try {
      const { data } = await api.post('/admin/richmenu/setup')
      setRichMsg(data.ok ? 'อัปเดตเมนู LINE สำเร็จ' : data.error || 'ไม่สำเร็จ')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setRichMsg(typeof msg === 'string' ? msg : 'ติดตั้งไม่สำเร็จ')
    } finally {
      setRichLoading(false)
    }
  }

  async function factoryReset() {
    if (!confirm('ล้างข้อมูลทั้งหมดยกเว้นบัญชีแอดมิน?')) return
    const typed = prompt('พิมพ์ RESET เพื่อยืนยัน')
    if (typed !== 'RESET') return
    try {
      const { data } = await api.post('/admin/factory-reset', { confirm: 'RESET' })
      setResetMsg(`ล้างแล้ว เหลือแอดมิน ${data.keptAdmins} บัญชี`)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setResetMsg(typeof msg === 'string' ? msg : 'ล้างไม่สำเร็จ')
    }
  }

  const plan = (sub?.owner.plan || 'TRIAL') as OwnerPlan
  const planLine = sub?.owner.permanent || plan === 'PERMANENT'
    ? 'ถาวร'
    : `${STATUS[sub?.owner.subscriptionStatus || ''] || OWNER_PLAN_LABEL[plan]}${sub?.owner.daysLeft != null ? ` · เหลือ ${sub.owner.daysLeft} วัน` : ''}${sub?.owner.expiresAt ? ` · ${thaiDate(sub.owner.expiresAt)}` : ''}`

  const ownerGroups = [
    {
      name: 'อาคารและการรับเงิน',
      items: [
        { t: 'อาคารทั้งหมด', v: propCount != null ? String(propCount) : '', path: '/admin/portfolio' },
        { t: 'PromptPay และรูป QR', v: propCount != null ? `${propCount} อาคาร` : '', path: '/admin/portfolio' },
      ],
    },
    {
      name: 'อัตโนมัติ',
      items: [
        { t: 'การแจ้งเตือน', v: '', path: '/admin/notifications' },
        { t: 'เทมเพลตสัญญา / ใบเสร็จ', v: '', path: '/admin/document-templates' },
      ],
    },
    {
      name: 'บัญชี',
      items: [
        { t: 'รายงานรายรับ', v: '', path: '/admin/reports' },
        { t: 'รหัสผ่าน Web Portal', v: '', path: '' },
        { t: 'ออกจากระบบ', v: '', path: 'logout' },
      ],
    },
  ]

  const adminGroups = [
    {
      name: 'แพลตฟอร์ม',
      items: [
        { t: 'การแจ้งเตือน', v: '', path: '/admin/notifications' },
        { t: 'รายงานภาพรวม', v: '', path: '/admin/reports' },
        { t: 'เทมเพลตเอกสาร', v: '', path: '/admin/document-templates' },
      ],
    },
    {
      name: 'บัญชี',
      items: [
        { t: 'รหัสผ่าน Web Portal', v: '', path: '' },
        { t: 'อัปเดต Rich Menu', v: '', path: 'richmenu' },
        { t: 'ล้างข้อมูลเทส', v: '', path: 'reset' },
        { t: 'ออกจากระบบ', v: '', path: 'logout' },
      ],
    },
  ]

  function onRow(path: string) {
    if (path === 'logout') {
      clearAuth()
      nav('/')
      return
    }
    if (path === '') {
      setShowPwd(true)
      return
    }
    if (path === 'richmenu') {
      void setupRichMenu()
      return
    }
    if (path === 'reset') {
      void factoryReset()
      return
    }
    nav(path)
  }

  const initial = (user?.name || 'A').replace(/^คุณ/, '').slice(0, 1)

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3.5">
        <h1 className="m-0 font-display text-[26px] font-bold">ตั้งค่า</h1>
        <section className="bg-white rounded-[18px] px-4 py-3.5 flex items-center gap-3">
          <span className="w-[52px] h-[52px] rounded-full bg-primary-soft text-primary font-display text-[22px] font-bold flex items-center justify-center">
            {initial}
          </span>
          <span className="flex-1 flex flex-col min-w-0">
            <strong className="text-base truncate">{user?.name}</strong>
            <span className="text-[13px] text-muted truncate">
              {isAdmin ? 'แอดมินแพลตฟอร์ม' : 'เจ้าของ'}
              {user?.lineLinked ? ' · ผูก LINE แล้ว' : ''}
              {user?.username ? ` · username: ${user.username}` : ''}
            </span>
          </span>
        </section>

        {!isAdmin && (
          <button type="button" className="bg-hero text-white rounded-[18px] px-4 py-3.5 flex items-center gap-3 text-left" onClick={() => nav('/admin/subscription')}>
            <span className="flex-1 flex flex-col">
              <span className="text-xs text-white/80">แพ็กเกจ</span>
              <strong className="text-base">{planLine}</strong>
              {sub?.bill && <span className="text-xs text-white/80">บิล {baht(sub.bill.amount)}</span>}
            </span>
            <span className="h-9 px-3.5 rounded-[10px] bg-brand text-ink text-sm font-bold flex items-center">ต่ออายุ</span>
          </button>
        )}

        {(isAdmin ? adminGroups : ownerGroups).map((g) => (
          <section key={g.name} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-muted pl-1">{g.name}</span>
            <div className="bg-white rounded-card overflow-hidden">
              {g.items.map((it) => (
                <button
                  key={it.t}
                  type="button"
                  className="w-full h-[52px] px-3.5 border-b border-line-soft flex items-center gap-3 text-left"
                  onClick={() => onRow(it.path)}
                >
                  <span className="flex-1 text-[15px]">{it.t}</span>
                  {it.v && <span className="text-[13px] text-muted">{it.v}</span>}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-placeholder" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        ))}

        {richMsg && <p className="text-sm text-muted">{richMsg}</p>}
        {resetMsg && <p className="text-sm text-muted">{resetMsg}</p>}

        {showPwd && (
          <form onSubmit={savePassword} className="bg-white rounded-card p-3.5 flex flex-col gap-2">
            <strong className="text-sm">รหัสผ่าน Web Portal</strong>
            <p className="text-xs text-muted break-all">{window.location.origin}/portal/login</p>
            <input aria-label="Username" className="h-11 border-[1.5px] border-line-input rounded-input px-3" value={username} onChange={(e) => setUsername(e.target.value)} />
            {user?.hasPassword && (
              <input aria-label="รหัสผ่านปัจจุบัน" type="password" className="h-11 border-[1.5px] border-line-input rounded-input px-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            )}
            <input aria-label="รหัสผ่านใหม่" type="password" className="h-11 border-[1.5px] border-line-input rounded-input px-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัว" />
            {pwdError && <p className="text-sm text-danger">{pwdError}</p>}
            {pwdMsg && <p className="text-sm text-ok-fg">{pwdMsg}</p>}
            <button type="submit" className="h-[52px] rounded-cta bg-primary text-white font-bold disabled:opacity-50" disabled={pwdLoading || !username || newPassword.length < 6}>
              {pwdLoading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </form>
        )}
        {richLoading && <p className="text-sm text-muted">กำลังอัปเดตเมนู LINE...</p>}
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
