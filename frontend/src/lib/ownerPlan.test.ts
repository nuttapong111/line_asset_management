import { describe, expect, it } from 'vitest'
import { OWNER_PLAN_LABEL, OWNER_PLAN_OPTIONS } from './ownerPlan'

describe('ownerPlan', () => {
  it('has label for every plan option', () => {
    for (const opt of OWNER_PLAN_OPTIONS) {
      expect(OWNER_PLAN_LABEL[opt.value]).toBeTruthy()
    }
  })

  it('includes TRIAL and PERMANENT', () => {
    const values = OWNER_PLAN_OPTIONS.map((o) => o.value)
    expect(values).toContain('TRIAL')
    expect(values).toContain('PERMANENT')
    expect(values).toContain('MONTHLY')
    expect(values).toContain('YEARLY')
  })
})
