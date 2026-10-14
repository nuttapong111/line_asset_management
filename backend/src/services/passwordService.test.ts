import { describe, expect, it } from 'vitest'
import {
  generateTempPassword,
  hashPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from './passwordService'

describe('passwordService', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('Secret123!')
    expect(hash).not.toBe('Secret123!')
    expect(await verifyPassword('Secret123!', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })

  it('generates temp password of requested length from safe charset', () => {
    const pw = generateTempPassword(12)
    expect(pw).toHaveLength(12)
    expect(pw).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]+$/)
  })

  it('normalizes email and username', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com')
    expect(normalizeUsername('  Admin.User ')).toBe('admin.user')
  })

  it('validates username rules', () => {
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('abc')).toBe(true)
    expect(isValidUsername('owner_01@x')).toBe(true)
    expect(isValidUsername('bad name')).toBe(false)
  })
})
