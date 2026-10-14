import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { signToken } from '../middleware/auth'

const { prisma } = vi.hoisted(() => ({
  prisma: {
    unit: { findFirst: vi.fn() },
    tenant: { count: vi.fn() },
  },
}))

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../middleware/subscriptionGuard', () => ({
  requireActiveSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../services/smsService', () => ({ sendSms: vi.fn() }))
vi.mock('../lib/line/richMenu', () => ({
  setTenantRichMenu: vi.fn(),
}))
vi.mock('../lib/line/lineService', () => ({
  pushInvite: vi.fn(),
  pushLinked: vi.fn(),
  pushText: vi.fn(),
  pushEntry: vi.fn(),
}))

import tenantsRouter from './tenants'

describe('POST /api/tenants legacy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects creating tenant without onboard (orphan guard)', async () => {
    prisma.unit.findFirst.mockResolvedValue({ id: 'u1', property: {} })
    prisma.tenant.count.mockResolvedValue(0)

    const app = express()
    app.use(express.json())
    app.use('/api/tenants', tenantsRouter)

    const token = signToken({ role: 'OWNER', ownerId: 'o1' })
    const res = await request(app)
      .post('/api/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'สมหญิง',
        phone: '0812345678',
        unitId: 'u1',
        startDate: '2026-01-01',
      })

    expect(res.status).toBe(400)
    expect(String(res.body.error)).toMatch(/onboard|สัญญา/)
  })
})
