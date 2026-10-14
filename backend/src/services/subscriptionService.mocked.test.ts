import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = vi.hoisted(() => ({
  prisma: {
    owner: { findUnique: vi.fn(), update: vi.fn() },
    subscriptionPayment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../lib/line/lineService', () => ({
  pushSubscriptionReminder: vi.fn(),
  pushSubscriptionSlipReceived: vi.fn(),
  pushSubscriptionResult: vi.fn(),
  pushText: vi.fn(),
}))
vi.mock('./storageService', () => ({
  uploadFile: vi.fn(),
  readFile: vi.fn(),
  extractStorageKey: (s: string) => s,
}))
vi.mock('./qrService', () => ({
  generatePromptPayPayload: () => 'QR',
}))

import { ensureSubscriptionBill, refreshOwnerSubscriptionStatus } from './subscriptionService'

describe('ensureSubscriptionBill (mocked)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null for PERMANENT', async () => {
    prisma.owner.findUnique.mockResolvedValue({ id: 'o1', plan: 'PERMANENT' })
    expect(await ensureSubscriptionBill('o1')).toBeNull()
  })

  it('reuses open PENDING_SLIP bill', async () => {
    prisma.owner.findUnique.mockResolvedValue({
      id: 'o1',
      plan: 'MONTHLY',
      subscriptionStatus: 'ACTIVE',
      expiresAt: new Date(Date.now() + 86400000),
    })
    const open = { id: 'bill1', status: 'PENDING_SLIP' }
    prisma.subscriptionPayment.findFirst.mockResolvedValue(open)
    expect(await ensureSubscriptionBill('o1')).toBe(open)
    expect(prisma.subscriptionPayment.create).not.toHaveBeenCalled()
  })

  it('does not create mid-trial far from expiry', async () => {
    prisma.owner.findUnique.mockResolvedValue({
      id: 'o1',
      plan: 'TRIAL',
      subscriptionStatus: 'TRIAL',
      expiresAt: new Date(Date.now() + 12 * 86400000),
    })
    prisma.subscriptionPayment.findFirst.mockResolvedValue(null)
    expect(await ensureSubscriptionBill('o1')).toBeNull()
  })

  it('creates when force=true', async () => {
    prisma.owner.findUnique.mockResolvedValue({
      id: 'o1',
      plan: 'TRIAL',
      subscriptionStatus: 'TRIAL',
      expiresAt: new Date(Date.now() + 12 * 86400000),
    })
    prisma.subscriptionPayment.findFirst.mockResolvedValue(null)
    prisma.subscriptionPayment.count.mockResolvedValue(0)
    prisma.subscriptionPayment.create.mockResolvedValue({ id: 'new', status: 'PENDING_SLIP' })
    const bill = await ensureSubscriptionBill('o1', { force: true })
    expect(bill?.id).toBe('new')
    expect(prisma.subscriptionPayment.create).toHaveBeenCalled()
  })
})

describe('refreshOwnerSubscriptionStatus (mocked)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not start trial when not activated', async () => {
    const owner = {
      id: 'o1',
      plan: 'TRIAL',
      subscriptionStatus: 'TRIAL',
      trialStartedAt: null,
      expiresAt: null,
    }
    prisma.owner.findUnique.mockResolvedValue(owner)
    const out = await refreshOwnerSubscriptionStatus('o1')
    expect(out).toBe(owner)
    expect(prisma.owner.update).not.toHaveBeenCalled()
  })

  it('marks SUSPENDED after grace', async () => {
    const expired = new Date()
    expired.setDate(expired.getDate() - 20)
    prisma.owner.findUnique.mockResolvedValue({
      id: 'o1',
      plan: 'MONTHLY',
      subscriptionStatus: 'GRACE',
      trialStartedAt: new Date('2026-01-01'),
      expiresAt: expired,
    })
    prisma.owner.update.mockImplementation(async ({ data }: { data: unknown }) => ({
      id: 'o1',
      ...(data as object),
    }))
    const out = await refreshOwnerSubscriptionStatus('o1')
    expect(out?.subscriptionStatus).toBe('SUSPENDED')
  })
})
