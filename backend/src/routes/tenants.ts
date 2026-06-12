import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'
import { sendSms } from '../services/smsService'
import { setTenantRichMenu } from '../lib/line/richMenu'
import { pushInvite, pushLinked } from '../lib/line/lineService'

const router = Router()
const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
// Invite links route by query param so they work even when LIFF drops the path
const tenantInviteUrl = (token: string) =>
  `${env.LIFF_BASE_URL.replace(/\/$/, '')}?token=${token}&invite=tenant`

const tenantSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  lineId: z.string().optional(),
  idCardNumber: z.string().optional(),
  unitId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
})

async function ownsUnit(adminId: string, unitId: string) {
  return prisma.unit.findFirst({
    where: { id: unitId, property: { adminId } },
    include: { property: true },
  })
}

// POST /api/tenants  (admin)
router.post('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const parse = tenantSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await ownsUnit(req.user!.adminId!, parse.data.unitId)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const tenant = await prisma.tenant.create({
    data: {
      name: parse.data.name,
      phone: parse.data.phone,
      lineId: parse.data.lineId,
      idCardNumber: parse.data.idCardNumber,
      unitId: parse.data.unitId,
      startDate: new Date(parse.data.startDate),
      endDate: parse.data.endDate ? new Date(parse.data.endDate) : null,
    },
  })
  res.status(201).json(tenant)
})

// GET /api/tenants/:id (admin)
router.get('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: { adminId: req.user!.adminId! } } },
    include: { unit: { include: { property: true } }, contracts: true },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  res.json(tenant)
})

// PUT /api/tenants/:id (admin)
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: { adminId: req.user!.adminId! } } },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  const parse = tenantSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const data: Record<string, unknown> = { ...parse.data }
  if (parse.data.startDate) data.startDate = new Date(parse.data.startDate)
  if (parse.data.endDate) data.endDate = new Date(parse.data.endDate)
  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data })
  res.json(updated)
})

// POST /api/tenants/link  { inviteToken, lineUserId? }  (authenticated NEW user)
router.post('/link', authMiddleware, async (req, res) => {
  const schema = z.object({ inviteToken: z.string().min(1), lineUserId: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const lineUserId = req.user?.lineUserId || parse.data.lineUserId
  if (!lineUserId) return res.status(400).json({ error: 'lineUserId required' })

  const unit = await prisma.unit.findUnique({
    where: { inviteToken: parse.data.inviteToken },
    include: { property: { include: { admin: true } }, tenants: { where: { isActive: true } } },
  })
  if (!unit) return res.status(404).json({ error: 'Invalid invite token' })
  if (unit.inviteExpiry && unit.inviteExpiry < new Date()) {
    return res.status(410).json({ error: 'Invite token expired' })
  }

  // Find an unlinked active tenant on this unit, else attach to most recent
  const tenant =
    unit.tenants.find((t) => !t.lineUserId) || unit.tenants[unit.tenants.length - 1]
  if (!tenant) return res.status(404).json({ error: 'No tenant record for this unit' })

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { lineUserId, linkedAt: new Date() },
  })
  await prisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } })

  await setTenantRichMenu(lineUserId)

  if (unit.property.admin.lineUserId) {
    await pushLinked(unit.property.admin.lineUserId, {
      tenantId: updated.id,
      tenantName: updated.name,
      roomNumber: unit.roomNumber,
      linkedAt: new Date().toLocaleString('th-TH'),
      profileUrl: liff(`/tenant/home`),
    })
  }

  // Re-issue JWT now that the user is a TENANT
  const token = signToken({ lineUserId, role: 'TENANT', unitId: unit.id, tenantId: updated.id })
  res.json({ ok: true, token, role: 'TENANT', tenant: updated })
})

// POST /api/tenants/:id/invite/sms (admin)
router.post('/:id/invite/sms', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: { adminId: req.user!.adminId! } } },
    include: { unit: { include: { property: true } } },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })

  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.unit.update({ where: { id: tenant.unitId }, data: { inviteExpiry: expiry } })
  const url = tenantInviteUrl(tenant.unit.inviteToken)
  const msg = `คุณได้รับคำเชิญเป็นผู้เช่า ${tenant.unit.property.name} ห้อง ${tenant.unit.roomNumber}\nกรุณากดลิงก์: ${url}`
  const result = await sendSms(tenant.phone, msg)
  await prisma.tenant.update({ where: { id: tenant.id }, data: { inviteSentAt: new Date() } })
  res.json({ ...result, inviteUrl: url })
})

// POST /api/tenants/:id/invite/line (admin)
router.post('/:id/invite/line', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: { adminId: req.user!.adminId! } } },
    include: { unit: { include: { property: true } } },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  if (!tenant.lineUserId) {
    return res.status(400).json({ error: 'Tenant has no LINE userId yet; use SMS invite first' })
  }
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.unit.update({ where: { id: tenant.unitId }, data: { inviteExpiry: expiry } })
  await pushInvite(tenant.lineUserId, {
    propertyName: tenant.unit.property.name,
    roomNumber: tenant.unit.roomNumber,
    rentAmount: Number(tenant.unit.rentPrice),
    startDate: tenant.startDate.toLocaleDateString('th-TH'),
    inviteUrl: tenantInviteUrl(tenant.unit.inviteToken),
  })
  await prisma.tenant.update({ where: { id: tenant.id }, data: { inviteSentAt: new Date() } })
  res.json({ ok: true })
})

export default router
