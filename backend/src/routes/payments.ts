import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env, liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'
import { generatePromptPayPayload } from '../services/qrService'
import { uploadFile } from '../services/storageService'
import { ocrSlip } from '../services/ocrService'
import { approvePayment, rejectPayment } from '../services/paymentService'
import { pushSlipReceived } from '../lib/line/lineService'
import { notifyOwnersPayment } from '../services/ownerNotify'

const router = Router()
router.use(authMiddleware)

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG/PNG allowed'))
  },
})

// GET /api/payments/:invoiceId/qr
router.get('/:invoiceId/qr', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.invoiceId },
    include: { unit: { include: { property: true } } },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (req.user!.role === 'TENANT' && invoice.unitId !== req.user!.unitId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const promptpayNumber = invoice.unit.property.promptpayNumber || env.DEFAULT_PROMPTPAY_NUMBER
  const amount = Number(invoice.total)
  const payload = generatePromptPayPayload(promptpayNumber, amount)
  res.json({
    payload,
    amount,
    promptpayNumber,
    // Static QR image uploaded by the manager (used instead of generating one)
    paymentQrUrl: invoice.unit.property.paymentQrUrl || null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  })
})

// POST /api/payments/:invoiceId/slip
router.post('/:invoiceId/slip', upload.single('file'), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.invoiceId },
    include: { unit: { include: { property: { include: { admin: true } }, tenants: { where: { isActive: true } } } } },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (req.user!.role === 'TENANT' && invoice.unitId !== req.user!.unitId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const tenant = invoice.unit.tenants[0]
  if (!tenant) return res.status(400).json({ error: 'No active tenant for this unit' })

  const key = `slips/${invoice.id}/${Date.now()}.jpg`
  const slipUrl = await uploadFile(key, req.file.buffer, req.file.mimetype)
  const ocr = await ocrSlip(slipUrl, Number(invoice.total), req.file.buffer)

  const payment = await prisma.payment.upsert({
    where: { invoiceId: invoice.id },
    create: {
      invoiceId: invoice.id,
      tenantId: tenant.id,
      slipUrl,
      slipUploadedAt: new Date(),
      ocrAmount: ocr.amount ?? undefined,
      ocrDate: ocr.date ?? undefined,
      ocrMatched: ocr.matched,
      status: 'UNDER_REVIEW',
    },
    update: {
      slipUrl,
      slipUploadedAt: new Date(),
      ocrAmount: ocr.amount ?? undefined,
      ocrDate: ocr.date ?? undefined,
      ocrMatched: ocr.matched,
      status: 'UNDER_REVIEW',
      rejectReason: null,
      rejectedAt: null,
    },
  })

  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'SLIP_UPLOADED' } })

  const adminLine = invoice.unit.property.admin.lineUserId
  if (adminLine) {
    await pushSlipReceived(adminLine, {
      paymentId: payment.id,
      invoiceId: invoice.id,
      roomNumber: invoice.unit.roomNumber,
      tenantName: tenant.name,
      amount: Number(invoice.total),
      slipUrl,
      reviewUrl: liff(`/admin/slip/${payment.id}`),
    })
  }

  await notifyOwnersPayment({
    propertyId: invoice.unit.property.id,
    roomNumber: invoice.unit.roomNumber,
    tenantName: tenant.name,
    amount: Number(invoice.total),
    kind: 'slip',
  })

  res.json({ ok: true, payment })
})

// Verify a payment belongs to the manager's scope (or the requesting tenant)
async function visiblePayment(req: import('express').Request, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { unit: { include: { property: true } } } }, tenant: true },
  })
  if (!payment) return null
  const p = payment.invoice.unit.property
  if (req.user!.role === 'TENANT') return payment.tenantId && req.user!.tenantId === payment.tenantId ? payment : null
  if (req.user!.role === 'ADMIN') return p.adminId === req.user!.adminId ? payment : null
  if (req.user!.role === 'OWNER') return p.ownerId === req.user!.ownerId ? payment : null
  return null
}

// True when the payment's property is within the manager's (ADMIN/OWNER) scope
async function managerOwnsPayment(req: import('express').Request, paymentId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, invoice: { unit: { property: propertyWhere(req.user!) } } },
  })
}

// GET /api/payments/:paymentId  (detail for review)
router.get('/:paymentId', async (req, res) => {
  const payment = await visiblePayment(req, req.params.paymentId)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(payment)
})

// POST /api/payments/:paymentId/approve (manager)
router.post('/:paymentId/approve', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  if (!(await managerOwnsPayment(req, req.params.paymentId)))
    return res.status(404).json({ error: 'Payment not found' })
  try {
    await approvePayment(req.params.paymentId)
    const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } })
    res.json({ ok: true, payment })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// POST /api/payments/:paymentId/reject (manager)
router.post('/:paymentId/reject', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const schema = z.object({ rejectReason: z.string().min(1) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  if (!(await managerOwnsPayment(req, req.params.paymentId)))
    return res.status(404).json({ error: 'Payment not found' })
  try {
    await rejectPayment(req.params.paymentId, parse.data.rejectReason)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/payments/:paymentId/receipt
router.get('/:paymentId/receipt', async (req, res) => {
  const payment = await visiblePayment(req, req.params.paymentId)
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json({ receiptUrl: payment.receiptUrl, receiptNo: payment.receiptNo })
})

export default router
