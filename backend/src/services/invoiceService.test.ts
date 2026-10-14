import { describe, expect, it } from 'vitest'
import {
  invoiceLineItems,
  invoiceTotalFromParts,
  resolveDueDate,
} from './invoiceService'

describe('invoiceTotalFromParts', () => {
  it('includes lateFee in total (regression: overdue bills)', () => {
    expect(
      invoiceTotalFromParts({
        rentAmount: 5000,
        electricAmount: 200,
        waterAmount: 100,
        commonFee: 300,
        lateFee: 90,
        extraAmount: 50,
      })
    ).toBe(5740)
  })

  it('treats missing numeric fields as 0 via Number()', () => {
    expect(
      invoiceTotalFromParts({
        rentAmount: 1000,
        electricAmount: 0,
        waterAmount: 0,
        commonFee: 0,
        lateFee: 0,
        extraAmount: 0,
      })
    ).toBe(1000)
  })
})

describe('invoiceLineItems', () => {
  it('builds rent lines with common fee, extras, and late fee', () => {
    const items = invoiceLineItems({
      type: 'RENT',
      rentAmount: 5000,
      electricAmount: 0,
      waterAmount: 0,
      commonFee: 200,
      lateFee: 30,
      extraItems: [{ label: 'ที่จอดรถ', amount: 500 }],
    })
    expect(items).toEqual([
      { label: 'ค่าเช่า', amount: 5000 },
      { label: 'ค่าส่วนกลาง', amount: 200 },
      { label: 'ที่จอดรถ', amount: 500 },
      { label: 'ค่าปรับล่าช้า', amount: 30 },
    ])
  })

  it('builds utility lines without rent', () => {
    const items = invoiceLineItems({
      type: 'UTILITY',
      rentAmount: 0,
      electricAmount: 450,
      waterAmount: 120,
      commonFee: 0,
      lateFee: 0,
    })
    expect(items).toEqual([
      { label: 'ค่าไฟฟ้า', amount: 450 },
      { label: 'ค่าน้ำ', amount: 120 },
    ])
  })
})

describe('resolveDueDate', () => {
  it('keeps due date in billing month when after contract start', () => {
    const start = new Date(2026, 0, 1) // 1 Jan
    const due = resolveDueDate(2026, 3, 5, start) // Mar 5
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(2)
    expect(due.getDate()).toBe(5)
  })

  it('rolls due to next month when before contract start (mid-month move-in)', () => {
    const start = new Date(2026, 2, 21) // 21 Mar
    const due = resolveDueDate(2026, 3, 5, start) // would be Mar 5 < start → Apr 5
    expect(due.getMonth()).toBe(3)
    expect(due.getDate()).toBe(5)
  })
})
