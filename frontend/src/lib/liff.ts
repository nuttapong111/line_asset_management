import liff from '@line/liff'
import api from './axios'
import { useAuthStore, Role } from '../store/authStore'

const LIFF_ID = import.meta.env.VITE_LIFF_ID

interface AuthResponse {
  token: string
  role: Role
  user: { lineUserId: string; name: string; pictureUrl?: string }
  unitId?: string
  adminId?: string
}

/**
 * Initialize LIFF, log in, exchange the LINE access token for our JWT.
 * In dev (no VITE_LIFF_ID) it falls back to mock login as ADMIN.
 */
export async function initLiff(mockRole: Role = 'ADMIN'): Promise<void> {
  const store = useAuthStore.getState()

  // ---- Dev / mock mode ----
  if (!LIFF_ID) {
    const { data } = await api.post<AuthResponse>('/auth/line', { mockRole })
    store.setAuth(data.token, data.role, data.user, { unitId: data.unitId, adminId: data.adminId })
    store.setReady(true)
    return
  }

  // ---- Real LIFF ----
  await liff.init({ liffId: LIFF_ID })
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href })
    return
  }
  const accessToken = liff.getAccessToken()
  const profile = await liff.getProfile()
  const { data } = await api.post<AuthResponse>('/auth/line', {
    accessToken,
    profile: { userId: profile.userId, displayName: profile.displayName, pictureUrl: profile.pictureUrl },
  })
  store.setAuth(data.token, data.role, data.user, { unitId: data.unitId, adminId: data.adminId })
  store.setReady(true)
}

export function closeLiff(): void {
  if (LIFF_ID && liff.isInClient()) {
    liff.closeWindow()
  } else {
    window.history.back()
  }
}

export { liff, LIFF_ID }
