import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { signToken } from '../middleware/auth'

const { prisma } = vi.hoisted(() => ({
  prisma: {
    invoice: { findFirst: vi.fn(), findUnique: vi.fn() },
    payment: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('../lib/prisma', () => ({ prisma }))
vi.mock('../middleware/subscriptionGuard', () => ({
  requireActiveSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
}))
vi.mock('../services/qrService', () => ({
  generatePromptPayPayload: (id: string, amount: number) => `QR:${id}:${amount}`,
}))
vi.mock('../services/ocrService', () => ({ ocrSlip: vi.fn() }))
vi.mock('../services/storageService', () => ({
  uploadFile: vi.fn(),
  readFile: vi.fn(),
  extractStorageKey: (s: string) => s,
}))
vi.mock('../services/paymentService', () => ({
  approvePayment: vi.fn(),
  rejectPayment: vi.fn(),
  ensureReceiptPdf: vi.fn(),
  receiptPdfLiffUrl: vi.fn(),
}))
vi.mock('../services/fileViewService', () => ({
  issueFileViewUrl: vi.fn(),
  issueFileViewUrls: vi.fn(),
}))
vi.mock('../lib/line/lineService', () => ({
  pushSlipReceived: vi.fn(),
  pushText: vi.fn(),
}))
vi.mock('../services/ownerNotify', () => ({
  notifyOwnersPayment: vi.fn(),
}))

import paymentsRouter from './payments'

describe('GET /api/payments/:invoiceId/qr', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns PromptPay payload with amount and expiry', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv1',
      total: 5450.5,
      status: 'PENDING',
      unitId: 'u1',
      unit: {
        id: 'u1',
        property: { promptpayNumber: '0812345678', ownerId: 'o1', paymentQrUrl: null },
      },
    })

    const app = express()
    app.use(express.json())
    app.use('/api/payments', paymentsRouter)

    const token = signToken({ role: 'TENANT', tenantId: 't1', unitId: 'u1', lineUserId: 'Ut' })
    const res = await request(app).get('/api/payments/inv1/qr').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.payload).toContain('QR:0812345678:5450.5')
    expect(res.body.amount).toBe(5450.5)
    expect(res.body.expiresAt).toBeTruthy()
  })
})
