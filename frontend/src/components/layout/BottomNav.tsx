import { useNavigate, useLocation } from 'react-router-dom'
import { cls } from '../../lib/utils'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
  bill: 'M9 7h6M9 11h6M9 15h4M5 3h14v18l-3-2-2 2-2-2-2 2-3-2V3z',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5L3 11a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1L9.5 21h5l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
  wrench: 'M14 7a4 4 0 01-5 5l-6 6 2 2 6-6a4 4 0 015-5l-2 2-2-2 2-2z',
  user: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z',
}

const adminNav: NavItem[] = [
  { label: 'ภาพรวม', path: '/admin/portfolio', icon: <Icon d={ICONS.home} /> },
  { label: 'บิล', path: '/admin/billing', icon: <Icon d={ICONS.bill} /> },
  { label: 'รายงาน', path: '/admin/reports', icon: <Icon d={ICONS.chat} /> },
  { label: 'ตั้งค่า', path: '/admin/settings', icon: <Icon d={ICONS.settings} /> },
]

const tenantNav: NavItem[] = [
  { label: 'หน้าหลัก', path: '/tenant/home', icon: <Icon d={ICONS.home} /> },
  { label: 'บิล', path: '/tenant/history', icon: <Icon d={ICONS.bill} /> },
  { label: 'แจ้งซ่อม', path: '/tenant/maintenance', icon: <Icon d={ICONS.wrench} /> },
  { label: 'โปรไฟล์', path: '/tenant/profile', icon: <Icon d={ICONS.user} /> },
]

export function BottomNav({ role }: { role: 'ADMIN' | 'TENANT' }) {
  const nav = useNavigate()
  const loc = useLocation()
  const items = role === 'ADMIN' ? adminNav : tenantNav
  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-100 grid grid-cols-4 h-16 max-w-md mx-auto">
      {items.map((it) => {
        const active = loc.pathname.startsWith(it.path)
        return (
          <button
            key={it.path}
            onClick={() => nav(it.path)}
            className={cls('flex flex-col items-center justify-center gap-0.5 text-xs', active ? 'text-line' : 'text-gray-400')}
          >
            {it.icon}
            <span>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
