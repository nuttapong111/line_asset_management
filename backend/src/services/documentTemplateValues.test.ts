import { describe, expect, it } from 'vitest'
import { contractValues, receiptValues } from './documentTemplateValues'

describe('contractValues', () => {
  it('maps contract fields to template strings', () => {
    const v = contractValues({
      contractNo: 'CTR-1',
      landlordName: 'A',
      propertyName: 'P',
      propertyAddress: 'Addr',
      roomNumber: '1',
      floor: 3,
      tenantName: 'T',
      tenantIdCard: '123',
      tenantPhone: '081',
      rentAmount: 1000,
      deposit: 2000,
      dueDay: 5,
      lateFeePerDay: 30,
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 5, 30),
      terms: 'x',
    })
    expect(v.contractNo).toBe('CTR-1')
    expect(v.floor).toBe('3')
    expect(v.dueDay).toBe('5')
    expect(v.rentAmount).toMatch(/1,000/)
    expect(v.terms).toBe('x')
  })
})

describe('receiptValues', () => {
  it('includes late fee line in itemsSummary when > 0', () => {
    const v = receiptValues({
      receiptNo: 'RCP-1',
      date: new Date(2026, 0, 15),
      propertyName: 'P',
      tenantName: 'T',
      roomNumber: '9',
      rentAmount: 5000,
      electricAmount: 100,
      waterAmount: 50,
      commonFee: 0,
      lateFee: 90,
      total: 5240,
    })
    expect(v.total).toMatch(/5,240/)
    expect(v.itemsSummary).toContain('ค่าปรับล่าช้า')
    expect(v.lateFee).toMatch(/90/)
  })
})
