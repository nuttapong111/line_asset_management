import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/axios'
import { baht, cls } from '../../lib/utils'

const ownerLinks = [
  { to: '/portal', end: true, label: 'ภาพรวม', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { to: '/portal/billing', end: false, label: 'บิลและการชำระ', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', badge: 'slips' as const },
  { to: '/portal/reports', end: false, label: 'รายงาน', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/portal/subscription', end: false, label: 'ค่าบริการ', icon: 'M4 7h16v12H4zM4 11h16M8 15h4' },
  { to: '/portal/settings', end: false, label: 'ตั้งค่า', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4' },
]

const adminLinks = [
  { to: '/portal', end: true, label: 'ภาพรวม', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  { to: '/portal/owners', end: false, label: 'เจ้าของ', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-3.9 3.1-7 7-7s7 3.1 7 7' },
  { to: '/portal/subscriptions', end: false, label: 'ตรวจสลิปค่าบริการ', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', badge: 'subs' as const },
  { to: '/portal/reports', end: false, label: 'รายงาน', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/portal/settings', end: false, label: 'ตั้งค่า', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4' },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export function PortalLayout() {
  const { user, role, clearAuth } = useAuthStore()
  const nav = useNavigate()
  const isAdmin = role === 'ADMIN'
  const isOwner = role === 'OWNER'
  const [slipCount, setSlipCount] = useState(0)
  const [subReview, setSubReview] = useState(0)
  const [pack, setPack] = useState<{ line: string; renew?: string }>()

  useEffect(() => {
    if (isOwner) {
      api
        .get('/reports/dashboard')
        .then((r) => setSlipCount(Number(r.data?.summary?.pendingSlips || 0)))
        .catch(() => {})
      api
        .get('/subscriptions/me')
        .then((r) => {
          const owner = r.data.owner
          const amount = r.data.bill?.amount
          let line = 'ค่าบริการ'
          if (owner.permanent || owner.plan === 'PERMANENT') line = 'ถาวร'
          else if (owner.subscriptionStatus === 'TRIAL') line = `ทดลองใช้ · เหลือ ${owner.daysLeft ?? '—'} วัน`
          else if (owner.subscriptionStatus === 'GRACE') line = 'ผ่อนผัน'
          else if (owner.subscriptionStatus === 'SUSPENDED') line = 'ระงับ'
          else if (owner.daysLeft !== null && owner.daysLeft !== undefined) line = `ใช้งาน · เหลือ ${owner.daysLeft} วัน`
          setPack({
            line,
            renew: amount ? `ต่ออายุ ${baht(amount)}` : 'ดูค่าบริการ',
          })
        })
        .catch(() => {})
    }
    if (isAdmin) {
      api
        .get('/subscriptions')
        .then((r) => setSubReview((r.data as { status: string }[]).filter((i) => i.status === 'UNDER_REVIEW').length))
        .catch(() => {})
    }
  }, [isAdmin, isOwner])

  function logout() {
    clearAuth()
    nav('/portal/login', { replace: true })
  }

  const links = isAdmin ? adminLinks : ownerLinks

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-wrap items-stretch">
      <aside
        className={cls(
          'flex flex-col gap-6 box-border text-white px-4 py-6 md:min-h-screen',
          isAdmin ? 'bg-sidebar-admin' : 'bg-sidebar'
        )}
        style={{ flex: '1 1 240px' }}
      >
        <div className="flex items-center gap-2.5 px-2">
          <span className="w-9 h-9 rounded-[10px] bg-brand flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20h14V9.5" />
            </svg>
          </span>
          {isAdmin ? (
            <div className="flex flex-col">
              <strong className="font-display text-lg leading-tight">PropFlow</strong>
              <span className="text-[11px] font-bold text-white/70 tracking-widest">ADMIN</span>
            </div>
          ) : (
            <strong className="font-display text-xl">PropFlow</strong>
          )}
        </div>

        <nav aria-label={isAdmin ? 'เมนูแอดมิน' : 'เมนูหลัก'} className="flex flex-col gap-1">
          {links.map((l) => {
            const count = l.badge === 'slips' ? slipCount : l.badge === 'subs' ? subReview : 0
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cls(
                    'h-11 rounded-[10px] px-3 flex items-center gap-3 no-underline text-[15px] font-semibold',
                    isActive
                      ? isAdmin
                        ? 'bg-white/20 text-white'
                        : 'bg-brand/20 text-white'
                      : 'text-white/70'
                  )
                }
              >
                <NavIcon d={l.icon} />
                <span className="flex-1">{l.label}</span>
                {count > 0 && (
                  <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-warn-chart text-ink text-xs font-bold flex items-center justify-center">
                    {count}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          {isOwner && pack && (
            <div className="bg-white/10 rounded-[14px] p-3.5 flex flex-col gap-1.5">
              <span className="text-xs text-white/70">แพ็กเกจ</span>
              <strong className="text-[15px]">{pack.line}</strong>
              <NavLink to="/portal/subscription" className="text-[13px] font-bold text-white/90">
                {pack.renew}
              </NavLink>
            </div>
          )}
          <div className="px-2">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <button type="button" onClick={logout} className="text-xs text-white/70 mt-2">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      <main
        className="min-w-0 box-border pt-7 pb-10 flex flex-col gap-6"
        style={{ flex: '999 1 560px', paddingLeft: 'clamp(16px, 3vw, 40px)', paddingRight: 'clamp(16px, 3vw, 40px)' }}
      >
        <Outlet />
      </main>
    </div>
  )
}
