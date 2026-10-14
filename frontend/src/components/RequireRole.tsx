import { Navigate } from 'react-router-dom'
import { useAuthStore, Role } from '../store/authStore'

export function isRoleAllowed(role: Role | null | undefined, allow: Role[]): boolean {
  return Boolean(role && allow.includes(role))
}

/** Block routes that the current JWT role must not open. */
export function RequireRole({
  allow,
  children,
}: {
  allow: Role[]
  children: React.ReactNode
}) {
  const role = useAuthStore((s) => s.role)
  if (!isRoleAllowed(role, allow)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
