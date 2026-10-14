import { describe, expect, it } from 'vitest'
import { CONTRACT_VARS, RECEIPT_VARS, sampleValues, varsForType } from './documentTemplateVars'

describe('documentTemplateVars', () => {
  it('returns distinct catalogs by type', () => {
    expect(varsForType('CONTRACT')).toBe(CONTRACT_VARS)
    expect(varsForType('RECEIPT')).toBe(RECEIPT_VARS)
    expect(CONTRACT_VARS.some((v) => v.key === 'deposit')).toBe(true)
    expect(RECEIPT_VARS.some((v) => v.key === 'total')).toBe(true)
  })

  it('sampleValues covers every variable key', () => {
    const contract = sampleValues('CONTRACT')
    for (const v of CONTRACT_VARS) {
      expect(contract[v.key]).toBe(v.sample)
    }
    const receipt = sampleValues('RECEIPT')
    for (const v of RECEIPT_VARS) {
      expect(receipt[v.key]).toBe(v.sample)
    }
  })
})
