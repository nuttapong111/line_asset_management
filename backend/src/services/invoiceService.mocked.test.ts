import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = vi.hoisted(() => ({
  prisma: {
    unit: { findUnique: vi.fn() },
    contract: { findFirst: vi.fn() },
    recurringFee: { findMany: vi.fn() },
    meterReading: { findFirst: vi.fn() },
  },
}))

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../lib/line/lineService', () => ({
  pushInvoice: vi.fn(),
  pushRentReminder: vi.fn(),
}))

import { buildRentInvoiceDraft, buildUtilityInvoiceDraft } from './invoiceService'

describe('buildRentInvoiceDraft (mocked prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sums rent + common + recurring fees', async () => {
    prisma.unit.findUnique.mockResolvedValue({
      id: 'u1',
      rentPrice: 5000,
      commonFee: 300,
    })
    prisma.contract.findFirst.mockResolvedValue({
      rentAmount: 5500,
      dueDay: 5,
      startDate: new Date(2026, 0, 1),
      status: 'ACTIVE',
    })
    prisma.recurringFee.findMany.mockResolvedValue([{ label: 'ที่จอด', amount: 500 }])

    const draft = await buildRentInvoiceDraft('u1', 3, 2026)
    expect(draft.type).toBe('RENT')
    expect(draft.rentAmount).toBe(5500)
    expect(draft.commonFee).toBe(300)
    expect(draft.extraAmount).toBe(500)
    expect(draft.total).toBe(6300)
    expect(draft.electricAmount).toBe(0)
  })

  it('throws without active contract', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1', rentPrice: 1, commonFee: 0 })
    prisma.contract.findFirst.mockResolvedValue(null)
    await expect(buildRentInvoiceDraft('u1', 1, 2026)).rejects.toThrow(/สัญญา/)
  })
})

describe('buildUtilityInvoiceDraft (mocked prisma)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes elec/water from meter delta × rates', async () => {
    prisma.unit.findUnique.mockResolvedValue({
      id: 'u1',
      electricRate: 8,
      waterRate: 20,
    })
    prisma.meterReading.findFirst.mockResolvedValue({
      prevElec: 100,
      currElec: 125,
      prevWater: 10,
      currWater: 15,
    })
    prisma.contract.findFirst.mockResolvedValue({
      dueDay: 5,
      startDate: new Date(2026, 0, 1),
    })

    const draft = await buildUtilityInvoiceDraft('u1', 3, 2026)
    expect(draft.type).toBe('UTILITY')
    expect(draft.electricAmount).toBe(25 * 8)
    expect(draft.waterAmount).toBe(5 * 20)
    expect(draft.total).toBe(200 + 100)
    expect(draft.meterReading?.usedElec).toBe(25)
  })

  it('throws when meter missing', async () => {
    prisma.unit.findUnique.mockResolvedValue({ id: 'u1', electricRate: 5, waterRate: 18 })
    prisma.meterReading.findFirst.mockResolvedValue(null)
    await expect(buildUtilityInvoiceDraft('u1', 1, 2026)).rejects.toThrow(/มิเตอร์/)
  })
})
