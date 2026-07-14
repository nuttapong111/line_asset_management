import { create } from 'zustand'

export type Role = 'ADMIN' | 'TENANT' | 'OWNER' | 'NEW'

export interface AuthUser {
  lineUserId: string
  name: string
  pictureUrl?: string
  username?: string
  hasPassword?: boolean
  lineLinked?: boolean
}

interface AuthState {
  jwt: string | null
  role: Role | null
  user: AuthUser | null
  unitId?: string
  adminId?: string
  ownerId?: string
  mustChangePassword: boolean
  authSource: 'liff' | 'portal' | null
  ready: boolean
  setAuth: (
    jwt: string,
    role: Role,
    user: AuthUser,
    extra?: {
      unitId?: string
      adminId?: string
      ownerId?: string
      mustChangePassword?: boolean
      authSource?: 'liff' | 'portal'
    }
  ) => void
  setReady: (ready: boolean) => void
  clearAuth: () => void
  hydratePortal: () => boolean
}

const PORTAL_KEY = 'propflow_portal_auth'

export const useAuthStore = create<AuthState>((set, get) => ({
  jwt: null,
  role: null,
  user: null,
  unitId: undefined,
  adminId: undefined,
  ownerId: undefined,
  mustChangePassword: false,
  authSource: null,
  ready: false,
  setAuth: (jwt, role, user, extra) => {
    const next = {
      jwt,
      role,
      user,
      unitId: extra?.unitId,
      adminId: extra?.adminId,
      ownerId: extra?.ownerId,
      mustChangePassword: Boolean(extra?.mustChangePassword),
      authSource: extra?.authSource ?? get().authSource,
    }
    set(next)
    if (next.authSource === 'portal') {
      try {
        sessionStorage.setItem(
          PORTAL_KEY,
          JSON.stringify({
            jwt: next.jwt,
            role: next.role,
            user: next.user,
            adminId: next.adminId,
            ownerId: next.ownerId,
            mustChangePassword: next.mustChangePassword,
          })
        )
      } catch {
        /* ignore */
      }
    }
  },
  setReady: (ready) => set({ ready }),
  clearAuth: () => {
    try {
      sessionStorage.removeItem(PORTAL_KEY)
    } catch {
      /* ignore */
    }
    set({
      jwt: null,
      role: null,
      user: null,
      unitId: undefined,
      adminId: undefined,
      ownerId: undefined,
      mustChangePassword: false,
      authSource: null,
    })
  },
  hydratePortal: () => {
    try {
      const raw = sessionStorage.getItem(PORTAL_KEY)
      if (!raw) return false
      const data = JSON.parse(raw) as {
        jwt: string
        role: Role
        user: AuthUser
        adminId?: string
        ownerId?: string
        mustChangePassword?: boolean
      }
      if (!data.jwt || !data.role) return false
      set({
        jwt: data.jwt,
        role: data.role,
        user: data.user,
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: Boolean(data.mustChangePassword),
        authSource: 'portal',
        ready: true,
      })
      return true
    } catch {
      return false
    }
  },
}))
