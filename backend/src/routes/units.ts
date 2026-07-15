import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere } from '../lib/scope'
import type { JwtPayload } from '../middleware/auth'

const router = Router()
const guard = [authMiddleware, requireRole('ADMIN', 'OWNER'), requireActiveSubscription] as const

// Invite links must be LIFF links so they open inside the LINE app
const inviteUrl = (token: string, type: 'tenant' | 'owner') =>
  `${liffEntryUrl.replace(/\/$/, '')}?token=${token}&invite=${type}`

const unitSchema = z.object({
  roomNumber: z.string().min(1),
  floor: z.number().int().optional(),
  rentPrice: z.number().nonnegative(),
  electricRate: z.number().nonnegative().optional(),
  waterRate: z.number().nonnegative().optional(),
  commonFee: z.number().nonnegative().optional(),
})

async function ownsProperty(user: JwtPayload, propertyId: string) {
  return prisma.property.findFirst({ where: { id: propertyId, ...propertyWhere(user) } })
}

// POST /api/properties/:id/units
router.post('/properties/:id/units', ...guard, async (req, res) => {
  const prop = await ownsProperty(req.user!, req.params.id)
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const parse = unitSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.create({ data: { ...parse.data, propertyId: prop.id } })
  res.status(201).json(unit)
})

// GET /api/properties/:id/units
router.get('/properties/:id/units', ...guard, async (req, res) => {
  const prop = await ownsProperty(req.user!, req.params.id)
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  const units = await prisma.unit.findMany({
    where: { propertyId: prop.id },
    include: { tenants: { where: { isActive: true } } },
    orderBy: { roomNumber: 'asc' },
  })
  res.json(units)
})

async function ownsUnit(user: JwtPayload, unitId: string) {
  return prisma.unit.findFirst({ where: { id: unitId, property: propertyWhere(user) } })
}

// PUT /api/units/:id
router.put('/units/:id', ...guard, async (req, res) => {
  const unit = await ownsUnit(req.user!, req.params.id)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  const parse = unitSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const updated = await prisma.unit.update({ where: { id: unit.id }, data: parse.data })
  res.json(updated)
})

// DELETE /api/units/:id
router.delete('/units/:id', ...guard, async (req, res) => {
  const unit = await ownsUnit(req.user!, req.params.id)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  if (unit.status !== 'VACANT') return res.status(400).json({ error: 'Only VACANT units can be deleted' })
  await prisma.unit.delete({ where: { id: unit.id } })
  res.json({ ok: true })
})

// GET /api/units/:id/invite-link
router.get('/units/:id/invite-link', ...guard, async (req, res) => {
  const unit = await ownsUnit(req.user!, req.params.id)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const updated = await prisma.unit.update({ where: { id: unit.id }, data: { inviteExpiry: expiry } })
  res.json({
    inviteToken: updated.inviteToken,
    inviteUrl: inviteUrl(updated.inviteToken, 'tenant'),
    expiresAt: expiry,
  })
})

export default router
