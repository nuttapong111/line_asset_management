import { describe, expect, it } from 'vitest'
import { isRoleAllowed } from './RequireRole'

describe('isRoleAllowed', () => {
  it('allows matching roles', () => {
    expect(isRoleAllowed('OWNER', ['OWNER', 'ADMIN'])).toBe(true)
    expect(isRoleAllowed('ADMIN', ['ADMIN'])).toBe(true)
  })

  it('denies missing or wrong role', () => {
    expect(isRoleAllowed(null, ['ADMIN'])).toBe(false)
    expect(isRoleAllowed('TENANT', ['ADMIN', 'OWNER'])).toBe(false)
  })
})
