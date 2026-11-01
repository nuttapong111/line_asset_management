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
      include: {
        property: { include: { owner: { select: { name: true, phone: true } } } },
        tenants: { where: { isActive: true }, take: 1 },
        contracts: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (unit) {
      const tenant = unit.tenants[0]
      const contract = unit.contracts[0]
      return res.json({
        type: 'tenant',
        roomNumber: unit.roomNumber,
        propertyName: unit.property.name,
        ownerName: unit.property.owner?.name || null,
        ownerPhone: unit.property.owner?.phone || null,
        tenantName: tenant?.name || null,
        rentAmount: contract ? Number(contract.rentAmount) : Number(unit.rentPrice),
        startDate: contract?.startDate || tenant?.startDate || null,
        endDate: contract?.endDate || tenant?.endDate || null,
        dueDay: contract?.dueDay ?? null,
        inviteExpiry: unit.inviteExpiry,
        expired: unit.inviteExpiry ? unit.inviteExpiry < new Date() : false,
      })
    }

  return res.status(404).json({ error: 'Invalid invite token' })
})

export default router
