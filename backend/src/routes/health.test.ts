import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/scheduler', () => ({
  startScheduler: vi.fn(),
}))

import request from 'supertest'
import app from '../app'

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
