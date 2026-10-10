import { Navigate } from 'react-router-dom'
import { useAuthStore, Role } from '../store/authStore'

/** Block routes that the current JWT role must not open. */
export function RequireRole({
  allow,
  children,
}: {
  allow: Role[]
  children: React.ReactNode
}) {
  const role = useAuthStore((s) => s.role)
  if (!role || !allow.includes(role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
