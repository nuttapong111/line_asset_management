import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { cls } from '../../lib/utils'

const links = [
  { to: '/portal', end: true, label: 'ภาพรวม' },
  { to: '/portal/reports', end: false, label: 'รายงาน' },
  { to: '/portal/settings', end: false, label: 'ตั้งค่า' },
]

export function PortalLayout() {
  const { user, role, clearAuth } = useAuthStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const isAdmin = role === 'ADMIN'

  function logout() {
    clearAuth()
    nav('/portal/login', { replace: true })
  }

  const navItems = (
    <>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cls(
              'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-line text-white' : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          {l.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          to="/portal/owners"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cls(
              'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-line text-white' : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          เจ้าของ
        </NavLink>
      )}
    </>
  )

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex">
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-white border-r border-gray-200 min-h-screen">
        <div className="p-5 border-b border-gray-100">
          <div className="text-lg font-bold text-line">PropFlow</div>
          <div className="text-xs text-gray-400 mt-0.5">Web Portal</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">{navItems}</nav>
        <div className="p-4 border-t border-gray-100">
          <div className="text-sm font-medium truncate">{user?.name}</div>
          <div className="text-xs text-gray-400 mb-2">{isAdmin ? 'ผู้ดูแลระบบ' : 'เจ้าของทรัพย์สิน'}</div>
          <button onClick={logout} className="text-xs text-danger hover:underline">
            ออกจากระบบ
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-line">PropFlow</div>
            <div className="text-[10px] text-gray-400">{user?.name}</div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100"
            onClick={() => setOpen((v) => !v)}
          >
            เมนู
          </button>
        </header>
        {open && (
          <div className="md:hidden bg-white border-b border-gray-100 p-3 space-y-1">
            {navItems}
            <button onClick={logout} className="block w-full text-left px-3 py-2 text-sm text-danger">
              ออกจากระบบ
            </button>
          </div>
        )}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
