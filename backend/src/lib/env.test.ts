import { describe, expect, it } from 'vitest'
import { env, isLineConfigured, isMockAuthAllowed, isTwilioConfigured, liffEntryUrl } from './env'

describe('env helpers', () => {
  it('exposes numeric subscription defaults', () => {
    expect(env.SUBSCRIPTION_PRICE).toBeGreaterThan(0)
    expect(env.SUBSCRIPTION_TRIAL_DAYS).toBeGreaterThan(0)
    expect(env.SUBSCRIPTION_GRACE_DAYS).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(env.SUBSCRIPTION_REMIND_DAYS)).toBe(true)
  })

  it('liffEntryUrl is absolute http(s)', () => {
    expect(liffEntryUrl.startsWith('http')).toBe(true)
  })

  it('config flags are boolean', () => {
    expect(typeof isLineConfigured).toBe('boolean')
    expect(typeof isMockAuthAllowed).toBe('boolean')
    expect(typeof isTwilioConfigured).toBe('boolean')
  })
})
