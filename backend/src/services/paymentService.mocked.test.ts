import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = vi.hoisted(() => ({
  prisma: {
    payment: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    invoice: { update: vi.fn() },
  },
}))

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../lib/line/lineService', () => ({
  pushSlipApproved: vi.fn(),
  pushText: vi.fn(),
}))
vi.mock('./ownerNotify', () => ({
  notifyOwnersPayment: vi.fn(),
}))
vi.mock('./pdfService', () => ({
  generateReceipt: vi.fn(async () => Buffer.from('%PDF')),
}))
vi.mock('./storageService', () => ({
  uploadFile: vi.fn(async () => 'r2://b/receipts/p.pdf'),
}))
vi.mock('./documentTemplateService', () => ({
  resolveDocumentTemplate: vi.fn(async () => null),
  renderTemplatePdf: vi.fn(),
}))

import { approvePayment, rejectPayment } from './paymentService'
import { pushSlipApproved, pushText } from '../lib/line/lineService'

describe('approvePayment / rejectPayment (mocked)', () => {
  beforeEach(() => vi.clearAllMocks())

  const basePayment = {
    id: 'p1',
    invoiceId: 'i1',
    status: 'UNDER_REVIEW',
    tenantId: 't1',
    receiptNo: null,
    approvedAt: null,
    tenant: { id: 't1', name: 'สมหญิง', isActive: true, lineUserId: 'Utenant' },
    invoice: {
      id: 'i1',
      unitId: 'u1',
      rentAmount: 5000,
      electricAmount: 0,
      waterAmount: 0,
      commonFee: 0,
      lateFee: 0,
      total: 5000,
      type: 'RENT',
      month: 3,
      year: 2026,
      extraItems: [],
      unit: {
        roomNumber: '201',
        tenants: [{ name: 'สมหญิง', lineUserId: 'Utenant', isActive: true }],
        property: { id: 'prop1', name: 'หอ', address: 'x', ownerId: 'o1' },
      },
    },
  }

  it('approve marks paid, generates receipt, notifies tenant', async () => {
    prisma.payment.findUnique.mockResolvedValue(basePayment)
    prisma.payment.count.mockResolvedValue(0)
    prisma.payment.update.mockResolvedValue({ ...basePayment, status: 'APPROVED', receiptNo: 'RCP-1' })
    prisma.invoice.update.mockResolvedValue({})

    await approvePayment('p1')
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PAID' } })
    )
    expect(pushSlipApproved).toHaveBeenCalled()
  })

  it('reject sets REJECTED and notifies tenant', async () => {
    prisma.payment.findUnique.mockResolvedValue(basePayment)
    prisma.payment.update.mockResolvedValue({})
    prisma.invoice.update.mockResolvedValue({})

    await rejectPayment('p1', 'ยอดไม่ตรง')
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED', rejectReason: 'ยอดไม่ตรง' }),
      })
    )
    expect(pushText).toHaveBeenCalled()
  })
})
