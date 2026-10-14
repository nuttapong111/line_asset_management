import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = vi.hoisted(() => {
  const p: any = {
    contract: { findUnique: vi.fn(), update: vi.fn() },
    invoice: { findMany: vi.fn(), updateMany: vi.fn() },
    moveOut: { create: vi.fn() },
    tenant: { update: vi.fn() },
    unit: { update: vi.fn() },
  }
  p.$transaction = vi.fn(async (fn: (tx: typeof p) => Promise<void>) => fn(p))
  return { prisma: p }
})

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../lib/line/richMenu', () => ({
  removeTenantRichMenu: vi.fn(),
}))

import { moveOutByContractId, moveOutPreview } from './tenantLifecycle'
import { removeTenantRichMenu } from '../lib/line/richMenu'

describe('moveOutPreview / moveOutByContractId (mocked)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preview sums unpaid and suggests refund', async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      deposit: 10000,
      unitId: 'u1',
      tenantId: 't1',
      tenant: { id: 't1', lineUserId: 'U1', name: 'T' },
      unit: { meterReadings: [] },
      moveOut: null,
    })
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'i1', type: 'RENT', month: 1, year: 2026, total: 3000, status: 'PENDING' },
      { id: 'i2', type: 'UTILITY', month: 1, year: 2026, total: 500, status: 'OVERDUE' },
    ])

    const p = await moveOutPreview('c1')
    expect(p.unpaidTotal).toBe(3500)
    expect(p.suggestedRefund).toBe(6500)
  })

  it('move-out cancels unpaid invoices and vacates unit', async () => {
    prisma.contract.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
      deposit: 10000,
      unitId: 'u1',
      tenantId: 't1',
      tenant: { id: 't1', lineUserId: 'U1', name: 'T' },
      unit: { meterReadings: [] },
      moveOut: null,
    })
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'i1', type: 'RENT', month: 1, year: 2026, total: 2000, status: 'PENDING' },
    ])

    const result = await moveOutByContractId('c1', {
      deductions: [{ label: 'ซ่อม', amount: 500 }],
    })
    expect(result.refundAmount).toBe(7500)
    expect(removeTenantRichMenu).toHaveBeenCalledWith('U1')
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['i1'] } },
        data: { status: 'CANCELLED' },
      })
    )
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'TERMINATED' } })
    )
    expect(prisma.unit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'VACANT' } })
    )
  })
})
