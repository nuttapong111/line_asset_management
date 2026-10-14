import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNext, mockReq, mockRes } from '../test/httpMock'

vi.mock('../lib/prisma', () => ({ prisma: {} }))
vi.mock('../services/subscriptionService', () => ({
  isOwnerWriteBlocked: (s: string) => s === 'SUSPENDED',
  refreshOwnerSubscriptionStatus: vi.fn(),
}))

import { requireActiveSubscription } from './subscriptionGuard'
import { refreshOwnerSubscriptionStatus } from '../services/subscriptionService'

const refresh = vi.mocked(refreshOwnerSubscriptionStatus)

describe('requireActiveSubscription', () => {
  beforeEach(() => {
    refresh.mockReset()
  })

  it('skips non-OWNER', async () => {
    const next = mockNext()
    await requireActiveSubscription(
      mockReq({ user: { role: 'ADMIN', adminId: 'a' }, method: 'POST' }),
      mockRes(),
      next
    )
    expect(next.called).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('allows GET reads for suspended owner', async () => {
    const next = mockNext()
    await requireActiveSubscription(
      mockReq({ user: { role: 'OWNER', ownerId: 'o1' }, method: 'GET' }),
      mockRes(),
      next
    )
    expect(next.called).toBe(true)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('allows subscription payment paths even when suspended', async () => {
    const next = mockNext()
    await requireActiveSubscription(
      mockReq({
        user: { role: 'OWNER', ownerId: 'o1' },
        method: 'POST',
        originalUrl: '/api/subscriptions/pay/slip',
        path: '/pay/slip',
      }),
      mockRes(),
      next
    )
    expect(next.called).toBe(true)
  })

  it('blocks write when SUSPENDED', async () => {
    refresh.mockResolvedValue({
      subscriptionStatus: 'SUSPENDED',
      expiresAt: new Date(),
    } as never)
    const res = mockRes()
    const next = mockNext()
    await requireActiveSubscription(
      mockReq({
        user: { role: 'OWNER', ownerId: 'o1' },
        method: 'POST',
        originalUrl: '/api/properties',
        path: '/',
      }),
      res,
      next
    )
    expect(next.called).toBe(false)
    expect(res.statusCode).toBe(403)
    expect((res.body as { code: string }).code).toBe('SUBSCRIPTION_SUSPENDED')
  })

  it('allows write when ACTIVE', async () => {
    refresh.mockResolvedValue({ subscriptionStatus: 'ACTIVE', expiresAt: new Date() } as never)
    const next = mockNext()
    await requireActiveSubscription(
      mockReq({
        user: { role: 'OWNER', ownerId: 'o1' },
        method: 'POST',
        originalUrl: '/api/units',
        path: '/',
      }),
      mockRes(),
      next
    )
    expect(next.called).toBe(true)
  })
})
