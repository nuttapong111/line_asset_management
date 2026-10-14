import { describe, expect, it } from 'vitest'
import {
  buildContractExpiryFlex,
  buildInviteFlex,
  buildInvoiceFlex,
  buildLinkedFlex,
  buildMaintNewFlex,
  buildOverdueFlex,
  buildReceiptFlex,
  buildReminderFlex,
  buildSlipReceivedFlex,
  buildSubscriptionReminderFlex,
  buildSubscriptionResultFlex,
  buildSubscriptionSlipReceivedFlex,
} from './flexMessages'

describe('flexMessages builders', () => {
  it('buildInvoiceFlex is flex with pay button', () => {
    const m = buildInvoiceFlex({
      invoiceId: 'i1',
      roomNumber: '201',
      tenantName: 'สมหญิง',
      month: 3,
      year: 2026,
      items: [{ label: 'ค่าเช่า', amount: 5000 }],
      total: 5000,
      dueDate: '5 มี.ค. 2569',
      liffUrl: 'https://example.com/pay',
    })
    expect(m.type).toBe('flex')
    expect(m.altText).toContain('201')
    expect(JSON.stringify(m)).toContain('ชำระเงิน')
  })

  it('buildReminderFlex / overdue / receipt', () => {
    expect(
      buildReminderFlex({
        invoiceId: 'i',
        roomNumber: '1',
        tenantName: 't',
        daysLeft: 3,
        amount: 100,
        dueDate: 'd',
        liffUrl: 'https://x',
      }).type
    ).toBe('flex')
    expect(
      buildOverdueFlex({
        invoiceId: 'i',
        roomNumber: '1',
        tenantName: 't',
        daysOverdue: 5,
        originalAmount: 100,
        lateFee: 50,
        total: 150,
        liffUrl: 'https://x',
      }).altText
    ).toContain('ค้างชำระ')
    expect(
      buildReceiptFlex({
        paymentId: 'p',
        receiptNo: 'RCP-1',
        roomNumber: '1',
        tenantName: 't',
        amount: 100,
        date: 'd',
        receiptUrl: 'https://x',
        historyUrl: 'https://h',
      }).altText
    ).toContain('RCP-1')
  })

  it('builds remaining flex types without throwing', () => {
    const all = [
      buildContractExpiryFlex({
        contractId: 'c',
        roomNumber: '1',
        tenantName: 't',
        daysLeft: 14,
        endDate: 'e',
        renewUrl: 'https://r',
        viewUrl: 'https://v',
      }),
      buildMaintNewFlex({
        ticketId: 't',
        ticketNo: 'M-1',
        title: 'น้ำรั่ว',
        roomNumber: '1',
        tenantName: 'n',
        category: 'PLUMBING',
        createdAt: 'now',
        viewUrl: 'https://v',
      }),
      buildSlipReceivedFlex({
        paymentId: 'p',
        invoiceId: 'i',
        roomNumber: '1',
        tenantName: 't',
        amount: 100,
        slipUrl: 'https://s',
        reviewUrl: 'https://r',
      }),
      buildLinkedFlex({
        tenantId: 't',
        tenantName: 'n',
        roomNumber: '1',
        linkedAt: 'now',
        profileUrl: 'https://p',
      }),
      buildInviteFlex({
        propertyName: 'P',
        roomNumber: '1',
        rentAmount: 5000,
        startDate: 'd',
        inviteUrl: 'https://i',
      }),
      buildSubscriptionReminderFlex({
        ownerName: 'o',
        daysLeft: 3,
        expiresAt: 'e',
        amount: 499,
        billNo: 'SUB-1',
        payUrl: 'https://p',
        status: 'TRIAL',
      }),
      buildSubscriptionSlipReceivedFlex({
        paymentId: 'p',
        billNo: 'SUB-1',
        ownerName: 'o',
        amount: 499,
        reviewUrl: 'https://r',
      }),
      buildSubscriptionResultFlex({
        ok: true,
        ownerName: 'o',
        amount: 499,
        billNo: 'SUB-1',
        expiresAt: 'e',
        reason: null,
      }),
    ]
    expect(all.every((m) => m.type === 'flex')).toBe(true)
  })
})
