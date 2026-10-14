import { resolveDueDate } from './invoiceService'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Calendar months to evaluate for auto-invoice (current + next). */
export function billingMonthsAround(now = new Date()): { year: number; month: number }[] {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const next = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 }
  return [
    { year: y, month: m },
    next,
  ]
}

/**
 * When to send the rent invoice for a billing month:
 * contract dueDay that month, minus `daysBefore`.
 * Example: dueDay=5, daysBefore=5 → send on the 1st for that month's bill.
 */
export function rentInvoiceSendDate(
  year: number,
  month: number,
  dueDay: number,
  daysBefore: number,
  contractStart: Date
): Date {
  const due = resolveDueDate(year, month, dueDay, contractStart)
  const send = startOfDay(due)
  send.setDate(send.getDate() - Math.max(0, daysBefore))
  return send
}

/** True if today is the auto-send day for this unit's billing month. */
export function shouldSendRentInvoiceToday(opts: {
  today?: Date
  dueDay: number
  daysBefore: number
  contractStart: Date
  year: number
  month: number
}): boolean {
  const today = startOfDay(opts.today ?? new Date())
  const send = rentInvoiceSendDate(
    opts.year,
    opts.month,
    opts.dueDay,
    opts.daysBefore,
    opts.contractStart
  )
  return isSameCalendarDay(today, send)
}
