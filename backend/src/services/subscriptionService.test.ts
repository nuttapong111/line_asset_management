import { describe, expect, it } from 'vitest'
import {
  daysUntil,
  grantPlanFields,
  isOwnerWriteBlocked,
  planPeriodDays,
  shouldCreateSubscriptionBill,
  trialExpiresAt,
} from './subscriptionService'

describe('planPeriodDays / trialExpiresAt', () => {
  it('maps plan types to period lengths', () => {
    expect(planPeriodDays('PERMANENT')).toBeNull()
    expect(planPeriodDays('MONTHLY')).toBeGreaterThan(0)
    expect(planPeriodDays('YEARLY')).toBeGreaterThan(30)
    expect(planPeriodDays('TRIAL')).toBeGreaterThan(0)
  })

  it('trialExpiresAt is SUBSCRIPTION_TRIAL_DAYS ahead', () => {
    const from = new Date(2026, 0, 1, 12, 0, 0)
    const exp = trialExpiresAt(from)
    const days = Math.round((exp.getTime() - from.getTime()) / 86400000)
    expect(days).toBe(planPeriodDays('TRIAL'))
  })
})

describe('grantPlanFields', () => {
  const from = new Date(2026, 5, 1, 10, 0, 0)

  it('PERMANENT is active with no expiry', () => {
    const f = grantPlanFields('PERMANENT', from)
    expect(f.plan).toBe('PERMANENT')
    expect(f.subscriptionStatus).toBe('ACTIVE')
    expect(f.expiresAt).toBeNull()
  })

  it('MONTHLY starts active with expiry', () => {
    const f = grantPlanFields('MONTHLY', from)
    expect(f.plan).toBe('MONTHLY')
    expect(f.subscriptionStatus).toBe('ACTIVE')
    expect(f.expiresAt).toBeInstanceOf(Date)
    expect(f.expiresAt!.getTime()).toBeGreaterThan(from.getTime())
  })

  it('TRIAL does not start clock until first login', () => {
    const f = grantPlanFields('TRIAL', from)
    expect(f.plan).toBe('TRIAL')
    expect(f.subscriptionStatus).toBe('TRIAL')
    expect(f.trialStartedAt).toBeNull()
    expect(f.expiresAt).toBeNull()
  })
})

describe('daysUntil / isOwnerWriteBlocked', () => {
  it('counts calendar days until expiry', () => {
    const from = new Date(2026, 0, 1, 15, 0, 0)
    const target = new Date(2026, 0, 8, 9, 0, 0)
    expect(daysUntil(target, from)).toBe(7)
    expect(daysUntil(null, from)).toBeNull()
  })

  it('blocks writes only when SUSPENDED', () => {
    expect(isOwnerWriteBlocked('SUSPENDED')).toBe(true)
    expect(isOwnerWriteBlocked('TRIAL')).toBe(false)
    expect(isOwnerWriteBlocked('ACTIVE')).toBe(false)
    expect(isOwnerWriteBlocked('GRACE')).toBe(false)
  })
})

describe('shouldCreateSubscriptionBill (trial / renewal gate)', () => {
  it('does not create mid-trial when far from expiry', () => {
    expect(
      shouldCreateSubscriptionBill({
        subscriptionStatus: 'TRIAL',
        daysLeft: 12,
        remindDays: [7, 3, 1],
      })
    ).toBe(false)
  })

  it('creates when within remind horizon', () => {
    expect(
      shouldCreateSubscriptionBill({
        subscriptionStatus: 'TRIAL',
        daysLeft: 7,
        remindDays: [7, 3, 1],
      })
    ).toBe(true)
  })

  it('creates on GRACE / SUSPENDED / force', () => {
    expect(
      shouldCreateSubscriptionBill({
        subscriptionStatus: 'GRACE',
        daysLeft: null,
      })
    ).toBe(true)
    expect(
      shouldCreateSubscriptionBill({
        subscriptionStatus: 'SUSPENDED',
        daysLeft: null,
      })
    ).toBe(true)
    expect(
      shouldCreateSubscriptionBill({
        force: true,
        subscriptionStatus: 'TRIAL',
        daysLeft: 14,
      })
    ).toBe(true)
  })

  it('does not create when expiry unknown (trial not started)', () => {
    expect(
      shouldCreateSubscriptionBill({
        subscriptionStatus: 'TRIAL',
        daysLeft: null,
      })
    ).toBe(false)
  })
})
