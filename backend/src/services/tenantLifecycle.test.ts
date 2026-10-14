import { describe, expect, it } from 'vitest'
import { computeMoveOutRefund, linkedTenant } from './tenantLifecycle'

describe('linkedTenant', () => {
  it('prefers tenant with LINE linked', () => {
    const a = { lineUserId: null as string | null, name: 'A' }
    const b = { lineUserId: 'U123', name: 'B' }
    expect(linkedTenant([a, b])?.name).toBe('B')
  })

  it('falls back to first tenant when none linked', () => {
    const a = { lineUserId: null as string | null, name: 'A' }
    const b = { lineUserId: null as string | null, name: 'B' }
    expect(linkedTenant([a, b])?.name).toBe('A')
  })

  it('returns undefined for empty list', () => {
    expect(linkedTenant([])).toBeUndefined()
  })
})

describe('computeMoveOutRefund', () => {
  it('refunds deposit minus unpaid and deductions', () => {
    const { refundAmount, deductionTotal } = computeMoveOutRefund(10000, 3000, [
      { label: 'ซ่อมผนัง', amount: 500 },
      { label: '  ', amount: 999 },
      { label: 'ขยะ', amount: 0 },
    ])
    expect(deductionTotal).toBe(500)
    expect(refundAmount).toBe(6500)
  })

  it('can go negative when unpaid exceeds deposit', () => {
    expect(computeMoveOutRefund(5000, 8000, []).refundAmount).toBe(-3000)
  })
})
