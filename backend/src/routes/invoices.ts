import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere, invoiceWhere } from '../lib/scope'
import { pushRentReminder } from '../lib/line/lineService'
import { liffEntryUrl } from '../lib/env'
import { linkedTenant } from '../services/tenantLifecycle'
import {
  buildRentInvoiceDraft,
  buildUtilityInvoiceDraft,
  createInvoiceFromDraft,
  applyDraftToInvoice,
  sendInvoiceLine,
  buildAndSendRentForProperty,
  buildAndSendUtilityForProperty,
} from '../services/invoiceService'

const router = Router()
router.use(authMiddleware, requireActiveSubscription)

// GET /api/invoices  (manager: scoped; tenant: own unit)
router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'TENANT'
      ? { unitId: req.user!.unitId! }
      : invoiceWhere(req.user!)
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      unit: { include: { tenants: { where: { isActive: true }, take: 1, select: { name: true } } } },
      payment: true,
      extraItems: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  const utility = invoices.filter((i) => i.type === 'UTILITY')
  const readings = utility.length
    ? await prisma.meterReading.findMany({
        where: {
          OR: utility.map((i) => ({ unitId: i.unitId, month: i.month, year: i.year })),
        },
      })
    : []
  res.json(
    invoices.map((inv) => {
      const meter = readings.find((r) => r.unitId === inv.unitId && r.month === inv.month && r.year === inv.year)
      const { tenants, ...unit } = inv.unit
      return {
        ...inv,
        unit,
        tenantName: tenants[0]?.name || null,
        usedElec: meter ? Math.max(0, Number(meter.currElec) - Number(meter.prevElec)) : null,
        usedWater: meter ? Math.max(0, Number(meter.currWater) - Number(meter.prevWater)) : null,
      }
    })
  )
})

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      unit: { include: { property: true, tenants: { where: { isActive: true } }, meterReadings: true } },
      payment: true,
      extraItems: true,
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
  try {
    const existing = await prisma.invoice.findFirst({
      where: {
        unitId: parse.data.unitId,
        month: parse.data.month,
        year: parse.data.year,
        type: parse.data.type,
      },
    })
    if (existing && !['PENDING', 'OVERDUE', 'CANCELLED'].includes(existing.status)) {
      return res.status(400).json({ error: 'บิลเดือนนี้มีอยู่แล้วและกำลังชำระ/ชำระแล้ว' })
    }
    const draft = await buildDraft(parse.data.unitId, parse.data.month, parse.data.year, parse.data.type)
    if (existing) {
      const invoice = await applyDraftToInvoice(existing.id, draft)
      if (existing.status === 'CANCELLED' || existing.status === 'OVERDUE') {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PENDING' } })
      }
      return res.status(200).json(invoice)
    }
    const invoice = await createInvoiceFromDraft(draft)
    res.status(201).json(invoice)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message || 'สร้างบิลไม่สำเร็จ' })
  }
})

// POST /api/invoices/build-preview (manager)
router.post('/build-preview', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: propertyWhere(req.user!) },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  try {
    const draft = await buildDraft(parse.data.unitId, parse.data.month, parse.data.year, parse.data.type)
    res.json(draft)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message || 'สร้างตัวอย่างบิลไม่สำเร็จ' })
  }
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

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

// POST /api/invoices/remind — ส่งเตือนบิลที่เลือก (Portal bulk)
router.post('/remind', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const schema = z.object({ invoiceIds: z.array(z.string().min(1)).min(1).max(200) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: parse.data.invoiceIds },
      status: { in: ['PENDING', 'OVERDUE'] },
      unit: { property: propertyWhere(req.user!) },
    },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  let sent = 0
  for (const inv of invoices) {
    const t = linkedTenant(inv.unit.tenants)
    if (!t?.lineUserId) continue
    const daysLeft = Math.ceil((inv.dueDate.getTime() - Date.now()) / 86400000)
    await pushRentReminder(t.lineUserId, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysLeft,
      amount: Number(inv.total),
      dueDate: inv.dueDate.toLocaleDateString('th-TH'),
      liffUrl: liff(`/payment/${inv.id}`),
    })
    sent += 1
  }
  res.json({ ok: true, sent, matched: invoices.length })
})

const extraItemsSchema = z.object({
  items: z.array(z.object({ label: z.string().min(1), amount: z.number() })),
})

// PUT /api/invoices/:id/extra-items — replace one-off + extra lines on a pending invoice
router.put('/:id/extra-items', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = extraItemsSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
    include: { extraItems: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (!['PENDING', 'OVERDUE'].includes(invoice.status)) {
    return res.status(400).json({ error: 'แก้รายการได้เฉพาะบิลที่ยังไม่ชำระ' })
  }

  const extraAmount = parse.data.items.reduce((a, i) => a + i.amount, 0)
  const total =
    Number(invoice.rentAmount) +
    Number(invoice.electricAmount) +
    Number(invoice.waterAmount) +
    Number(invoice.commonFee) +
    Number(invoice.lateFee) +
    extraAmount

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } })
    if (parse.data.items.length) {
      await tx.invoiceItem.createMany({
        data: parse.data.items.map((i) => ({ invoiceId: invoice.id, label: i.label, amount: i.amount })),
      })
    }
    return tx.invoice.update({
      where: { id: invoice.id },
      data: { extraAmount, total },
      include: { extraItems: true, unit: true, payment: true },
    })
  })
  res.json(updated)
})

export default router
