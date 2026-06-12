import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'
import { setTenantRichMenu } from '../lib/line/richMenu'

const router = Router()
// Invite links route by query param so they work even when LIFF drops the path
const ownerInviteUrl = (token: string) =>
  `${env.LIFF_BASE_URL.replace(/\/$/, '')}?token=${token}&invite=owner`

// ---------- Admin: manage owners of a property ----------

// POST /api/properties/:id/owners (admin)
router.post('/properties/:id/owners', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const prop = await prisma.property.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const schema = z.object({ name: z.string().min(1), phone: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const owner = await prisma.owner.create({
    data: { name: parse.data.name, phone: parse.data.phone, propertyId: prop.id, inviteExpiry: expiry },
  })
  res.status(201).json({ ...owner, inviteUrl: ownerInviteUrl(owner.inviteToken) })
})

// GET /api/properties/:id/owners (admin)
router.get('/properties/:id/owners', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const prop = await prisma.property.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const owners = await prisma.owner.findMany({ where: { propertyId: prop.id }, orderBy: { createdAt: 'desc' } })
  res.json(owners.map((o) => ({ ...o, inviteUrl: ownerInviteUrl(o.inviteToken) })))
})

// GET /api/owners/:id/invite-link (admin) — refresh expiry + return link
router.get('/owners/:id/invite-link', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const owner = await prisma.owner.findFirst({
    where: { id: req.params.id, property: { adminId: req.user!.adminId! } },
  })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const updated = await prisma.owner.update({ where: { id: owner.id }, data: { inviteExpiry: expiry } })
  res.json({ inviteToken: updated.inviteToken, inviteUrl: ownerInviteUrl(updated.inviteToken), expiresAt: expiry })
})

// DELETE /api/owners/:id (admin)
router.delete('/owners/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const owner = await prisma.owner.findFirst({
    where: { id: req.params.id, property: { adminId: req.user!.adminId! } },
  })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  await prisma.owner.delete({ where: { id: owner.id } })
  res.json({ ok: true })
})

// ---------- Owner: link account ----------

// POST /api/owners/link  { inviteToken }
router.post('/owners/link', authMiddleware, async (req, res) => {
  const schema = z.object({ inviteToken: z.string().min(1), lineUserId: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const lineUserId = req.user?.lineUserId || parse.data.lineUserId
  if (!lineUserId) return res.status(400).json({ error: 'lineUserId required' })

  const owner = await prisma.owner.findUnique({ where: { inviteToken: parse.data.inviteToken } })
  if (!owner) return res.status(404).json({ error: 'Invalid invite token' })
  if (owner.inviteExpiry && owner.inviteExpiry < new Date()) {
    return res.status(410).json({ error: 'Invite token expired' })
  }

  const updated = await prisma.owner.update({
    where: { id: owner.id },
    data: { lineUserId, linkedAt: new Date() },
  })
  await setTenantRichMenu(lineUserId)
  const token = signToken({ lineUserId, role: 'OWNER', ownerId: updated.id })
  res.json({ ok: true, token, role: 'OWNER', owner: updated })
})

// ---------- Owner: dashboard data (across owned properties) ----------

async function ownerPropertyIds(lineUserId: string): Promise<string[]> {
  const owners = await prisma.owner.findMany({ where: { lineUserId, linkedAt: { not: null } } })
  return owners.map((o) => o.propertyId)
}

const ownerOnly = [authMiddleware, requireRole('OWNER')] as const

// GET /api/owner/summary
router.get('/owner/summary', ...ownerOnly, async (req, res) => {
  const propIds = await ownerPropertyIds(req.user!.lineUserId)
  const invoices = await prisma.invoice.findMany({ where: { unit: { propertyId: { in: propIds } } } })
  let collected = 0
  let pending = 0
  let overdue = 0
  for (const i of invoices) {
    const amt = Number(i.total)
    if (i.status === 'PAID') collected += amt
    else if (i.status === 'OVERDUE') overdue += amt
    else pending += amt
  }
  const properties = await prisma.property.findMany({
    where: { id: { in: propIds } },
    include: { units: true },
  })
  res.json({
    summary: { collected, pending, overdue },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      units: p.units.length,
      occupied: p.units.filter((u) => u.status === 'OCCUPIED').length,
    })),
  })
})

// GET /api/owner/payments
router.get('/owner/payments', ...ownerOnly, async (req, res) => {
  const propIds = await ownerPropertyIds(req.user!.lineUserId)
  const payments = await prisma.payment.findMany({
    where: { invoice: { unit: { propertyId: { in: propIds } } } },
    include: { tenant: true, invoice: { include: { unit: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(payments)
})

// GET /api/owner/payments/:id
router.get('/owner/payments/:id', ...ownerOnly, async (req, res) => {
  const propIds = await ownerPropertyIds(req.user!.lineUserId)
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, invoice: { unit: { propertyId: { in: propIds } } } },
    include: { tenant: true, invoice: { include: { unit: { include: { property: true } } } } },
  })
  if (!payment) return res.status(404).json({ error: 'Payment not found' })
  res.json(payment)
})

// GET /api/owner/maintenance
router.get('/owner/maintenance', ...ownerOnly, async (req, res) => {
  const propIds = await ownerPropertyIds(req.user!.lineUserId)
  const tickets = await prisma.maintenance.findMany({
    where: { unit: { propertyId: { in: propIds } } },
    include: { unit: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(tickets)
})

// GET /api/owner/maintenance/:id
router.get('/owner/maintenance/:id', ...ownerOnly, async (req, res) => {
  const propIds = await ownerPropertyIds(req.user!.lineUserId)
  const ticket = await prisma.maintenance.findFirst({
    where: { id: req.params.id, unit: { propertyId: { in: propIds } } },
    include: { unit: { include: { property: true } }, messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  res.json(ticket)
})

export default router
