import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import {
  buildInvoiceDraft,
  createInvoiceFromDraft,
  sendInvoiceLine,
  buildAndSendForProperty,
} from '../services/invoiceService'

const router = Router()
router.use(authMiddleware)

// GET /api/invoices  (admin: all; tenant: own unit)
router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'ADMIN'
      ? { unit: { property: { adminId: req.user!.adminId! } } }
      : { unitId: req.user!.unitId! }
  const invoices = await prisma.invoice.findMany({
    where,
    include: { unit: true, payment: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(invoices)
})

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      unit: { include: { property: true, tenants: { where: { isActive: true } }, meterReadings: true } },
      payment: true,
    },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (req.user!.role === 'TENANT' && invoice.unitId !== req.user!.unitId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.user!.role === 'ADMIN' && invoice.unit.property.adminId !== req.user!.adminId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const meter = await prisma.meterReading.findFirst({
    where: { unitId: invoice.unitId, month: invoice.month, year: invoice.year },
  })
  res.json({ ...invoice, meterReading: meter })
})

const createSchema = z.object({
  unitId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
})

// POST /api/invoices (admin) — build + save
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: { adminId: req.user!.adminId! } },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  const draft = await buildInvoiceDraft(parse.data.unitId, parse.data.month, parse.data.year)
  const invoice = await createInvoiceFromDraft(draft)
  res.status(201).json(invoice)
})

// POST /api/invoices/build-preview (admin)
router.post('/build-preview', requireRole('ADMIN'), async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const draft = await buildInvoiceDraft(parse.data.unitId, parse.data.month, parse.data.year)
  res.json(draft)
})

// POST /api/invoices/:id/send (admin)
router.post('/:id/send', requireRole('ADMIN'), async (req, res) => {
  const ok = await sendInvoiceLine(req.params.id)
  res.json({ ok })
})

// POST /api/invoices/send-bulk | send-all (admin)
const bulkSchema = z.object({
  propertyId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
})
async function sendAllHandler(req: import('express').Request, res: import('express').Response) {
  const parse = bulkSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const prop = await prisma.property.findFirst({
    where: { id: parse.data.propertyId, adminId: req.user!.adminId! },
  })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const result = await buildAndSendForProperty(parse.data.propertyId, parse.data.month, parse.data.year)
  res.json(result)
}
router.post('/send-bulk', requireRole('ADMIN'), sendAllHandler)
router.post('/send-all', requireRole('ADMIN'), sendAllHandler)

export default router
