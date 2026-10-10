import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'
import type { JwtPayload } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere } from '../lib/scope'
import { sendSms } from '../services/smsService'
import { setTenantRichMenu } from '../lib/line/richMenu'
import { pushInvite, pushLinked, pushText, pushEntry } from '../lib/line/lineService'
import { linkedTenant } from '../services/tenantLifecycle'

const router = Router()
const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
// Invite links must be LIFF links so they open inside the LINE app
const tenantInviteUrl = (token: string) =>
  `${liffEntryUrl.replace(/\/$/, '')}?token=${token}&invite=tenant`

const tenantSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  lineId: z.string().optional(),
  idCardNumber: z.string().optional(),
  unitId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
})

const managerGuard = [authMiddleware, requireRole('ADMIN', 'OWNER'), requireActiveSubscription] as const

async function ownsUnit(user: JwtPayload, unitId: string) {
  return prisma.unit.findFirst({
    where: { id: unitId, property: propertyWhere(user) },
    include: { property: true },
  })
}

// POST /api/tenants  (manager)
router.post('/', ...managerGuard, async (req, res) => {
  const parse = tenantSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await ownsUnit(req.user!, parse.data.unitId)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const activeCount = await prisma.tenant.count({
    where: { unitId: parse.data.unitId, isActive: true },
  })
  if (activeCount > 0) {
    return res.status(400).json({
      error: 'ห้องนี้มีผู้เช่าอยู่แล้ว กรุณายกเลิกสัญญาและปล่อยห้องก่อนเพิ่มผู้เช่าใหม่',
    })
  }

  // Legacy endpoint — UI uses POST /tenants/onboard. Kept only for resume-contract orphans.
  return res.status(400).json({
    error: 'กรุณาสร้างผู้เช่าพร้อมสัญญาผ่านขั้นตอนเพิ่มผู้เช่า (onboard) เพื่อไม่ให้เกิดห้องไม่มีสัญญา',
  })
})

const onboardSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  lineId: z.string().optional(),
  idCardNumber: z.string().optional(),
  unitId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  rentAmount: z.number().nonnegative(),
  deposit: z.number().nonnegative(),
  lateFeePerDay: z.number().nonnegative().optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  terms: z.string().optional(),
})

/** POST /api/tenants/onboard — create tenant + contract + occupy unit in one step */
router.post('/onboard', ...managerGuard, async (req, res) => {
  const parse = onboardSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await ownsUnit(req.user!, parse.data.unitId)
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const activeCount = await prisma.tenant.count({
    where: { unitId: parse.data.unitId, isActive: true },
  })
  if (activeCount > 0) {
    return res.status(400).json({
      error: 'ห้องนี้มีผู้เช่าอยู่แล้ว กรุณายกเลิกสัญญาและปล่อยห้องก่อนเพิ่มผู้เช่าใหม่',
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: parse.data.name,
        phone: parse.data.phone,
        lineId: parse.data.lineId,
        idCardNumber: parse.data.idCardNumber,
        unitId: parse.data.unitId,
        startDate: new Date(parse.data.startDate),
        endDate: new Date(parse.data.endDate),
      },
    })
    const contract = await tx.contract.create({
      data: {
        tenantId: tenant.id,
        unitId: parse.data.unitId,
        startDate: new Date(parse.data.startDate),
        endDate: new Date(parse.data.endDate),
        rentAmount: parse.data.rentAmount,
        deposit: parse.data.deposit,
        lateFeePerDay: parse.data.lateFeePerDay ?? 30,
        dueDay: parse.data.dueDay ?? 5,
        terms: parse.data.terms,
      },
    })
    await tx.unit.update({
      where: { id: parse.data.unitId },
      data: { status: 'OCCUPIED', rentPrice: parse.data.rentAmount },
    })
    return { tenant, contract }
  })
  res.status(201).json(result)
})

// GET /api/tenants/:id (manager)
router.get('/:id', ...managerGuard, async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
    include: { unit: { include: { property: true } }, contracts: true },
  })
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
  res.json(tenant)
})

// PUT /api/tenants/:id (manager)
router.put('/:id', ...managerGuard, async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
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

  if (req.user?.role === 'ADMIN' || req.user?.role === 'OWNER') {
    return res.status(409).json({
      error: 'บัญชี LINE นี้เป็นแอดมิน/เจ้าของอยู่แล้ว — ใช้ LINE อื่นสำหรับผู้เช่า',
    })
  }
  const asAdmin = await prisma.admin.findUnique({ where: { lineUserId } })
  if (asAdmin) {
    return res.status(409).json({
      error: 'บัญชี LINE นี้ผูกเป็นผู้ดูแลระบบอยู่แล้ว — ใช้ LINE อื่นสำหรับผู้เช่า',
    })
  }
  const asOwner = await prisma.owner.findFirst({ where: { lineUserId, linkedAt: { not: null } } })
  if (asOwner) {
    return res.status(409).json({
      error: 'บัญชี LINE นี้ผูกเป็นเจ้าของอยู่แล้ว — ใช้ LINE อื่นสำหรับผู้เช่า',
    })
  }

  const unit = await prisma.unit.findUnique({
    where: { inviteToken: parse.data.inviteToken },
    include: { property: { include: { admin: true, owner: true } }, tenants: { where: { isActive: true } } },
  })
  if (!unit) return res.status(404).json({ error: 'Invalid invite token' })
  if (unit.inviteExpiry && unit.inviteExpiry < new Date()) {
    return res.status(410).json({ error: 'ลิงก์เชิญหมดอายุแล้ว กรุณาขอใหม่จากเจ้าของห้อง' })
  }
  const hasContract = await prisma.contract.findFirst({
    where: { unitId: unit.id, status: 'ACTIVE' },
  })
  if (!hasContract) {
    return res.status(400).json({ error: 'ห้องนี้ยังไม่มีสัญญาเช่า — แจ้งเจ้าของให้ตั้งสัญญาก่อน' })
  }

  // Prefer unlinked tenant awaiting invite; else the linked active tenant
  const tenant =
    unit.tenants.find((t) => !t.lineUserId) || linkedTenant(unit.tenants)
  if (!tenant) return res.status(404).json({ error: 'No tenant record for this unit' })

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { lineUserId, linkedAt: new Date() },
  })
  await prisma.unit.update({ where: { id: unit.id }, data: { status: 'OCCUPIED' } })

  await setTenantRichMenu(lineUserId)

  // OA greets the tenant right after linking (so one invite link = chat + connect)
  try {
    await pushText(
      lineUserId,
      `สวัสดีครับ คุณ${updated.name} 🏠\nผูกห้อง ${unit.property.name} ห้อง ${unit.roomNumber} สำเร็จแล้ว\nใช้เมนูด้านล่างเพื่อชำระเงิน ดูเอกสาร หรือแจ้งซ่อมได้เลย`
    )
    await pushEntry(lineUserId, 'แตะเพื่อเปิดหน้าหลักผู้เช่า', 'เปิดหน้าหลัก')
  } catch (err) {
    console.error('[LINE] tenant welcome after link failed', err)
  }

  // Notify the property manager (owner if present, otherwise the admin)
  const managerLineId = unit.property.owner?.lineUserId || unit.property.admin.lineUserId
  if (managerLineId) {
    await pushLinked(managerLineId, {
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

// POST /api/tenants/:id/invite/sms (manager)
router.post('/:id/invite/sms', ...managerGuard, async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
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

// POST /api/tenants/:id/invite/line (manager)
router.post('/:id/invite/line', ...managerGuard, async (req, res) => {
  const tenant = await prisma.tenant.findFirst({
    where: { id: req.params.id, unit: { property: propertyWhere(req.user!) } },
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
