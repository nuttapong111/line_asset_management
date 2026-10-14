import { useNavigate, useLocation } from 'react-router-dom'
import { cls } from '../../lib/utils'
import { navItemsForRole, type NavRole } from '../../lib/navItems'

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS: Record<string, string> = {
  '/admin/portfolio': 'M3 12l9-9 9 9M5 10v10h14V10',
  '/admin/subscriptions': 'M9 7h6M9 11h6M9 15h4M5 3h14v18l-3-2-2 2-2-2-2 2-3-2V3z',
  '/admin/owners': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  '/admin/settings': 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L14.5 3h-5l-.3 2.5a7 7 0 00-1.7 1l-2.4-1-2 3.5L3 11a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1L9.5 21h5l.3-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1z',
  '/admin/billing': 'M9 7h6M9 11h6M9 15h4M5 3h14v18l-3-2-2 2-2-2-2 2-3-2V3z',
  '/community': 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  '/tenant/home': 'M3 12l9-9 9 9M5 10v10h14V10',
  '/documents': 'M7 3h8l4 4v14H7V3zM15 3v4h4',
  '/tenant/maintenance': 'M14 7a4 4 0 01-5 5l-6 6 2 2 6-6a4 4 0 015-5l-2 2-2-2 2-2z',
}

export function BottomNav({ role }: { role: NavRole }) {
  const nav = useNavigate()
  const loc = useLocation()
  const items = navItemsForRole(role)
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
            <Icon d={ICONS[it.path] || ICONS['/admin/portfolio']} />
            <span>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
