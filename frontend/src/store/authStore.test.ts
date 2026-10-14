import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAuthStore.getState().clearAuth()
    useAuthStore.setState({ ready: false })
  })

  it('setAuth stores jwt and role', () => {
    useAuthStore.getState().setAuth('jwt1', 'OWNER', { lineUserId: 'U1', name: 'Own' }, {
      ownerId: 'o1',
      authSource: 'liff',
    })
    const s = useAuthStore.getState()
    expect(s.jwt).toBe('jwt1')
    expect(s.role).toBe('OWNER')
    expect(s.ownerId).toBe('o1')
    expect(sessionStorage.getItem('propflow_portal_auth')).toBeNull()
  })

  it('persists portal session and hydrates', () => {
    useAuthStore.getState().setAuth(
      'jwt2',
      'ADMIN',
      { lineUserId: 'U2', name: 'Adm', username: 'admin' },
      { adminId: 'a1', authSource: 'portal', mustChangePassword: true }
    )
    const saved = sessionStorage.getItem('propflow_portal_auth')
    expect(saved).toBeTruthy()
    // Reset in-memory state without wiping session (simulates page reload)
    useAuthStore.setState({
      jwt: null,
      role: null,
      user: null,
      adminId: undefined,
      ownerId: undefined,
      mustChangePassword: false,
      authSource: null,
      ready: false,
    })
    sessionStorage.setItem('propflow_portal_auth', saved!)
    const ok = useAuthStore.getState().hydratePortal()
    expect(ok).toBe(true)
    expect(useAuthStore.getState().role).toBe('ADMIN')
    expect(useAuthStore.getState().mustChangePassword).toBe(true)
    expect(useAuthStore.getState().authSource).toBe('portal')
  })

  it('hydratePortal returns false when empty', () => {
    expect(useAuthStore.getState().hydratePortal()).toBe(false)
  })
})
