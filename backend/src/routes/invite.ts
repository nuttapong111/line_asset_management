import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

/**
 * GET /api/invite/info?token=...
 * Detects whether an invite token belongs to an owner or a tenant (unit) and
 * returns display info. No auth required — used to render the confirm screen
 * without relying on a query param surviving the LIFF redirect.
 */
router.get('/info', async (req, res) => {
  const token = String(req.query.token || '').trim()
  if (!token) return res.status(400).json({ error: 'token required' })

  const owner = await prisma.owner.findUnique({
    where: { inviteToken: token },
    include: { properties: { select: { name: true } } },
  })
  if (owner) {
    return res.json({
      type: 'owner',
      name: owner.name,
      propertyName: owner.properties.map((p) => p.name).join(', ') || null,
      expired: owner.inviteExpiry ? owner.inviteExpiry < new Date() : false,
      linked: Boolean(owner.linkedAt),
    })
  }

  const unit = await prisma.unit.findUnique({
    where: { inviteToken: token },
    include: { property: true },
  })
  if (unit) {
    return res.json({
      type: 'tenant',
      roomNumber: unit.roomNumber,
      propertyName: unit.property.name,
      expired: unit.inviteExpiry ? unit.inviteExpiry < new Date() : false,
    })
  }

  return res.status(404).json({ error: 'Invalid invite token' })
})

export default router
