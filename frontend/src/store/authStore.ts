import { create } from 'zustand'

export type Role = 'ADMIN' | 'TENANT' | 'NEW'

export interface AuthUser {
  lineUserId: string
  name: string
  pictureUrl?: string
}

interface AuthState {
  jwt: string | null
  role: Role | null
  user: AuthUser | null
  unitId?: string
  adminId?: string
  ready: boolean
  setAuth: (jwt: string, role: Role, user: AuthUser, extra?: { unitId?: string; adminId?: string }) => void
  setReady: (ready: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  jwt: null,
  role: null,
  user: null,
  unitId: undefined,
  adminId: undefined,
  ready: false,
  setAuth: (jwt, role, user, extra) =>
    set({ jwt, role, user, unitId: extra?.unitId, adminId: extra?.adminId }),
  setReady: (ready) => set({ ready }),
  clearAuth: () => set({ jwt: null, role: null, user: null, unitId: undefined, adminId: undefined }),
}))
