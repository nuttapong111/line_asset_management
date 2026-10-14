import { describe, expect, it } from 'vitest'
import {
  billingMonthsAround,
  rentInvoiceSendDate,
  shouldSendRentInvoiceToday,
} from './billingSchedule'

describe('rentInvoiceSendDate', () => {
  const start = new Date(2026, 0, 1)

  it('dueDay 5, 4 days before → send on the 1st (calendar)', () => {
    const send = rentInvoiceSendDate(2026, 3, 5, 4, start)
    expect(send.getFullYear()).toBe(2026)
    expect(send.getMonth()).toBe(2) // March
    expect(send.getDate()).toBe(1)
  })

  it('dueDay 5, 0 days before → send on due day', () => {
    const send = rentInvoiceSendDate(2026, 3, 5, 0, start)
    expect(send.getDate()).toBe(5)
    expect(send.getMonth()).toBe(2)
  })

  it('dueDay 5, 5 days before → previous month (Mar 5 − 5 = Feb 28)', () => {
    const send = rentInvoiceSendDate(2026, 3, 5, 5, start)
    expect(send.getMonth()).toBe(1)
    expect(send.getDate()).toBe(28)
  })
})

describe('shouldSendRentInvoiceToday', () => {
  it('matches only the computed send day', () => {
    const start = new Date(2026, 0, 1)
    expect(
      shouldSendRentInvoiceToday({
        today: new Date(2026, 2, 1),
        dueDay: 5,
        daysBefore: 4,
        contractStart: start,
        year: 2026,
        month: 3,
      })
    ).toBe(true)
    expect(
      shouldSendRentInvoiceToday({
        today: new Date(2026, 2, 5),
        dueDay: 5,
        daysBefore: 4,
        contractStart: start,
        year: 2026,
        month: 3,
      })
    ).toBe(false)
  })
})

describe('billingMonthsAround', () => {
  it('returns current and next month', () => {
    const months = billingMonthsAround(new Date(2026, 11, 15)) // Dec
    expect(months).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ])
  })
})
