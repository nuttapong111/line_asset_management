import { useAuthStore } from '../store/authStore'

export function useAuth() {
  return useAuthStore()
}

export function useRole() {
  return useAuthStore((s) => s.role)
}
