import { describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'

vi.mock('../lib/prisma', () => ({ prisma: {} }))

function buildApp() {
  const app = express()
  app.get('/admin-only', authMiddleware, requireRole('ADMIN'), (_req, res) => res.json({ ok: true }))
  app.get('/owner-or-admin', authMiddleware, requireRole('OWNER', 'ADMIN'), (_req, res) =>
    res.json({ ok: true })
  )
  return app
}

describe('route role guards (integration-lite)', () => {
  const app = buildApp()

  it('admin token passes admin-only', async () => {
    const token = signToken({ role: 'ADMIN', adminId: 'a1' })
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('owner token forbidden on admin-only', async () => {
    const token = signToken({ role: 'OWNER', ownerId: 'o1' })
    const res = await request(app).get('/admin-only').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('owner token allowed on owner-or-admin', async () => {
    const token = signToken({ role: 'OWNER', ownerId: 'o1' })
    const res = await request(app).get('/owner-or-admin').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('tenant forbidden on owner-or-admin', async () => {
    const token = signToken({ role: 'TENANT', tenantId: 't1', unitId: 'u1' })
    const res = await request(app).get('/owner-or-admin').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
