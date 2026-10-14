import { describe, expect, it } from 'vitest'
import { baht, cls, thaiMonth } from './utils'

describe('baht', () => {
  it('formats THB with baht sign', () => {
    expect(baht(1500)).toMatch(/^฿/)
    expect(baht(1500)).toContain('1')
    expect(baht(null)).toMatch(/฿0/)
    expect(baht(undefined)).toMatch(/฿0/)
  })
})

describe('thaiMonth', () => {
  it('maps month number to Thai short name', () => {
    expect(thaiMonth(1)).toBe('ม.ค.')
    expect(thaiMonth(12)).toBe('ธ.ค.')
    expect(thaiMonth(0)).toBe('0')
  })
})

describe('cls', () => {
  it('joins truthy class parts', () => {
    expect(cls('a', false, null, 'b', undefined)).toBe('a b')
  })
})
