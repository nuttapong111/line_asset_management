import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere, invoiceWhere } from '../lib/scope'
import {
  buildRentInvoiceDraft,
  buildUtilityInvoiceDraft,
  createInvoiceFromDraft,
  sendInvoiceLine,
  buildAndSendRentForProperty,
  buildAndSendUtilityForProperty,
} from '../services/invoiceService'

const router = Router()
router.use(authMiddleware)

// GET /api/invoices  (manager: scoped; tenant: own unit)
router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'TENANT'
      ? { unitId: req.user!.unitId! }
      : invoiceWhere(req.user!)
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
  if (req.user!.role === 'OWNER' && invoice.unit.property.ownerId !== req.user!.ownerId) {
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
  type: z.enum(['RENT', 'UTILITY']).optional().default('RENT'),
})

async function buildDraft(unitId: string, month: number, year: number, type: 'RENT' | 'UTILITY') {
  return type === 'UTILITY'
    ? buildUtilityInvoiceDraft(unitId, month, year)
    : buildRentInvoiceDraft(unitId, month, year)
}

// POST /api/invoices (manager) — build + save
router.post('/', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: propertyWhere(req.user!) },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  const draft = await buildDraft(parse.data.unitId, parse.data.month, parse.data.year, parse.data.type)
  const invoice = await createInvoiceFromDraft(draft)
  res.status(201).json(invoice)
})

// POST /api/invoices/build-preview (manager)
router.post('/build-preview', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: propertyWhere(req.user!) },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  const draft = await buildDraft(parse.data.unitId, parse.data.month, parse.data.year, parse.data.type)
  res.json(draft)
})

// POST /api/invoices/:id/send (manager)
router.post('/:id/send', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  const ok = await sendInvoiceLine(req.params.id)
  res.json({ ok })
})

// POST /api/invoices/send-bulk | send-all (admin)
const bulkSchema = z.object({
  propertyId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  type: z.enum(['RENT', 'UTILITY']).optional().default('RENT'),
})
async function sendAllHandler(req: import('express').Request, res: import('express').Response) {
  const parse = bulkSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const prop = await prisma.property.findFirst({
    where: { id: parse.data.propertyId, ...propertyWhere(req.user!) },
  })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const result =
    parse.data.type === 'UTILITY'
      ? await buildAndSendUtilityForProperty(parse.data.propertyId, parse.data.month, parse.data.year)
      : await buildAndSendRentForProperty(parse.data.propertyId, parse.data.month, parse.data.year)
  res.json(result)
}
router.post('/send-bulk', requireRole('ADMIN', 'OWNER'), sendAllHandler)
router.post('/send-all', requireRole('ADMIN', 'OWNER'), sendAllHandler)

export default router
