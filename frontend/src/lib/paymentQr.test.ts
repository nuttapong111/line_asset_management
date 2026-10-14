import { describe, expect, it } from 'vitest'
import { formatCountdown, qrSecondsLeft } from './paymentQr'

describe('qrSecondsLeft', () => {
  it('defaults to 30 minutes when no expiry', () => {
    expect(qrSecondsLeft(null)).toBe(1800)
  })

  it('computes remaining seconds', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    const exp = '2026-01-01T12:10:00Z'
    expect(qrSecondsLeft(exp, now)).toBe(600)
  })

  it('never goes negative', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(qrSecondsLeft('2026-01-01T11:00:00Z', now)).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('pads mm:ss and flags expired', () => {
    expect(formatCountdown(125)).toEqual({ mm: '02', ss: '05', expired: false })
    expect(formatCountdown(0)).toEqual({ mm: '00', ss: '00', expired: true })
  })
})
