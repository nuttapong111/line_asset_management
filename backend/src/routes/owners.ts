import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'
import { setAdminRichMenu } from '../lib/line/richMenu'

const router = Router()

// Invite links must be LIFF links (https://liff.line.me/<id>) so they open
// inside the LINE app; query params survive even if LIFF drops the path.
const ownerInviteUrl = (token: string) =>
  `${liffEntryUrl.replace(/\/$/, '')}?token=${token}&invite=owner`

const adminOnly = [authMiddleware, requireRole('ADMIN')] as const

// ---------- Admin: manage owner accounts (the SaaS "customers") ----------

// POST /api/owners (admin) — create an owner account under this admin
router.post('/owners', ...adminOnly, async (req, res) => {
  const schema = z.object({ name: z.string().min(1), phone: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const owner = await prisma.owner.create({
    data: {
      name: parse.data.name,
      phone: parse.data.phone,
      adminId: req.user!.adminId!,
      inviteExpiry: expiry,
    },
  })
  res.status(201).json({ ...owner, inviteUrl: ownerInviteUrl(owner.inviteToken) })
})

// GET /api/owners (admin) — list owner accounts + property counts
router.get('/owners', ...adminOnly, async (req, res) => {
  const owners = await prisma.owner.findMany({
    where: { adminId: req.user!.adminId! },
    include: { properties: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(
    owners.map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone,
      linkedAt: o.linkedAt,
      lineUserId: o.lineUserId,
      properties: o.properties,
      inviteUrl: ownerInviteUrl(o.inviteToken),
    }))
  )
})

// GET /api/owners/:id (admin) — owner detail
router.get('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({
    where: { id: req.params.id, adminId: req.user!.adminId! },
    include: { properties: { include: { units: true } } },
  })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  res.json({ ...owner, inviteUrl: ownerInviteUrl(owner.inviteToken) })
})

// PUT /api/owners/:id (admin)
router.put('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const schema = z.object({ name: z.string().min(1).optional(), phone: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const updated = await prisma.owner.update({ where: { id: owner.id }, data: parse.data })
  res.json(updated)
})

// GET /api/owners/:id/invite-link (admin) — refresh expiry + return link
router.get('/owners/:id/invite-link', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const updated = await prisma.owner.update({ where: { id: owner.id }, data: { inviteExpiry: expiry } })
  res.json({ inviteToken: updated.inviteToken, inviteUrl: ownerInviteUrl(updated.inviteToken), expiresAt: expiry })
})

// DELETE /api/owners/:id (admin) — unassign their properties then delete
router.delete('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  await prisma.property.updateMany({ where: { ownerId: owner.id }, data: { ownerId: null } })
  await prisma.owner.delete({ where: { id: owner.id } })
  res.json({ ok: true })
})

// POST /api/owners/:id/properties (admin) — assign a property to this owner
router.post('/owners/:id/properties', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const schema = z.object({ propertyId: z.string().min(1) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const prop = await prisma.property.findFirst({
    where: { id: parse.data.propertyId, adminId: req.user!.adminId! },
  })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const updated = await prisma.property.update({ where: { id: prop.id }, data: { ownerId: owner.id } })
  res.json(updated)
})

// DELETE /api/owners/:id/properties/:propertyId (admin) — unassign
router.delete('/owners/:id/properties/:propertyId', ...adminOnly, async (req, res) => {
  const prop = await prisma.property.findFirst({
    where: { id: req.params.propertyId, adminId: req.user!.adminId!, ownerId: req.params.id },
  })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  await prisma.property.update({ where: { id: prop.id }, data: { ownerId: null } })
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
  // Owners are managers now → give them the manager (admin) rich menu
  setAdminRichMenu(lineUserId).catch(() => {})
  const token = signToken({ lineUserId, role: 'OWNER', ownerId: updated.id })
  res.json({ ok: true, token, role: 'OWNER', owner: updated })
})

export default router
