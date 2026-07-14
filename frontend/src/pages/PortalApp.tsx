import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { PortalLayout } from './portal/PortalLayout'
import PortalLogin from './portal/PortalLogin'
import PortalRegister from './portal/PortalRegister'
import PortalChangePassword from './portal/PortalChangePassword'
import PortalDashboard from './portal/PortalDashboard'
import PortalReports from './portal/PortalReports'
import PortalSettings from './portal/PortalSettings'
import PortalOwners from './portal/PortalOwners'

function PortalGuard({ children }: { children: React.ReactNode }) {
  const jwt = useAuthStore((s) => s.jwt)
  const role = useAuthStore((s) => s.role)
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)
  const authSource = useAuthStore((s) => s.authSource)
  const hydratePortal = useAuthStore((s) => s.hydratePortal)
  const loc = useLocation()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!jwt) hydratePortal()
    setChecked(true)
  }, [jwt, hydratePortal])

  if (!checked) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  }

  const authed = Boolean(jwt && (role === 'ADMIN' || role === 'OWNER') && authSource === 'portal')
  if (!authed) return <Navigate to="/portal/login" replace state={{ from: loc }} />
  if (mustChangePassword && loc.pathname !== '/portal/change-password') {
    return <Navigate to="/portal/change-password" replace />
  }
  return <>{children}</>
}

export default function PortalApp() {
  useEffect(() => {
    useAuthStore.getState().setReady(true)
  }, [])

  return (
    <Routes>
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/register" element={<PortalRegister />} />
      <Route
        path="/portal/change-password"
        element={
          <PortalGuard>
            <PortalChangePassword />
          </PortalGuard>
        }
      />
      <Route
        path="/portal"
        element={
          <PortalGuard>
            <PortalLayout />
          </PortalGuard>
        }
      >
        <Route index element={<PortalDashboard />} />
        <Route path="reports" element={<PortalReports />} />
        <Route path="settings" element={<PortalSettings />} />
        <Route path="owners" element={<PortalOwners />} />
      </Route>
      <Route path="/portal/*" element={<Navigate to="/portal" replace />} />
    </Routes>
  )
}
