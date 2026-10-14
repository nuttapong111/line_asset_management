import { describe, expect, it } from 'vitest'
import { isQuietHour } from './scheduler'

describe('isQuietHour', () => {
  it('detects same-day quiet window', () => {
    expect(isQuietHour('23:00', '22:00', '07:00')).toBe(true)
    expect(isQuietHour('06:59', '22:00', '07:00')).toBe(true)
    expect(isQuietHour('07:00', '22:00', '07:00')).toBe(false)
    expect(isQuietHour('12:00', '22:00', '07:00')).toBe(false)
  })

  it('handles daytime window', () => {
    expect(isQuietHour('13:00', '12:00', '14:00')).toBe(true)
    expect(isQuietHour('11:00', '12:00', '14:00')).toBe(false)
  })

  it('returns false when start === end', () => {
    expect(isQuietHour('10:00', '08:00', '08:00')).toBe(false)
  })
})
