import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole, signToken } from '../middleware/auth'
import { setAdminRichMenu } from '../lib/line/richMenu'
import {
  generateTempPassword,
  hashPassword,
  isValidUsername,
  normalizeUsername,
} from '../services/passwordService'

const router = Router()

const ownerInviteUrl = (token: string) =>
  `${liffEntryUrl.replace(/\/$/, '')}?token=${token}&invite=owner`

const adminOnly = [authMiddleware, requireRole('ADMIN')] as const

// POST /api/owners (admin) — create owner with portal credentials + LINE invite
router.post('/owners', ...adminOnly, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    username: z.string().min(3),
    password: z.string().min(6).optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'กรุณากรอกชื่อและ Username (อย่างน้อย 3 ตัว)' })
  if (!isValidUsername(parse.data.username)) {
    return res.status(400).json({ error: 'Username ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ @ + - (3–64 ตัว)' })
  }

  const username = normalizeUsername(parse.data.username)
  const taken =
    (await prisma.admin.findUnique({ where: { username } })) ||
    (await prisma.owner.findUnique({ where: { username } }))
  if (taken) return res.status(409).json({ error: 'Username นี้ถูกใช้แล้ว' })

  const tempPassword = parse.data.password || generateTempPassword()
  const passwordHash = await hashPassword(tempPassword)
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const owner = await prisma.owner.create({
    data: {
      name: parse.data.name,
      phone: parse.data.phone,
      username,
      passwordHash,
      mustChangePassword: true,
      adminId: req.user!.adminId!,
      inviteExpiry: expiry,
    },
  })

  res.status(201).json({
    id: owner.id,
    name: owner.name,
    phone: owner.phone,
    username: owner.username,
    mustChangePassword: owner.mustChangePassword,
    inviteUrl: ownerInviteUrl(owner.inviteToken),
    temporaryPassword: tempPassword,
  })
})

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
      username: o.username,
      hasPassword: Boolean(o.passwordHash),
      mustChangePassword: o.mustChangePassword,
      linkedAt: o.linkedAt,
      lineUserId: o.lineUserId,
      properties: o.properties,
      inviteUrl: ownerInviteUrl(o.inviteToken),
    }))
  )
})

router.get('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({
    where: { id: req.params.id, adminId: req.user!.adminId! },
    include: { properties: { include: { units: true } } },
  })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const { passwordHash: _, ...safe } = owner
  res.json({ ...safe, inviteUrl: ownerInviteUrl(owner.inviteToken) })
})

router.put('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const schema = z.object({ name: z.string().min(1).optional(), phone: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const updated = await prisma.owner.update({ where: { id: owner.id }, data: parse.data })
  const { passwordHash: _, ...safe } = updated
  res.json(safe)
})

router.post('/owners/:id/reset-password', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const tempPassword = generateTempPassword()
  await prisma.owner.update({
    where: { id: owner.id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  })
  res.json({ ok: true, username: owner.username, temporaryPassword: tempPassword })
})

router.get('/owners/:id/invite-link', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const updated = await prisma.owner.update({ where: { id: owner.id }, data: { inviteExpiry: expiry } })
  res.json({ inviteToken: updated.inviteToken, inviteUrl: ownerInviteUrl(updated.inviteToken), expiresAt: expiry })
})

router.delete('/owners/:id', ...adminOnly, async (req, res) => {
  const owner = await prisma.owner.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!owner) return res.status(404).json({ error: 'Owner not found' })
  await prisma.property.updateMany({ where: { ownerId: owner.id }, data: { ownerId: null } })
  await prisma.owner.delete({ where: { id: owner.id } })
  res.json({ ok: true })
})

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

router.delete('/owners/:id/properties/:propertyId', ...adminOnly, async (req, res) => {
  const prop = await prisma.property.findFirst({
    where: { id: req.params.propertyId, adminId: req.user!.adminId!, ownerId: req.params.id },
  })
  if (!prop) return res.status(404).json({ error: 'Property not found' })
  await prisma.property.update({ where: { id: prop.id }, data: { ownerId: null } })
  res.json({ ok: true })
})

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
  setAdminRichMenu(lineUserId).catch(() => {})
  const token = signToken({
    lineUserId,
    role: 'OWNER',
    ownerId: updated.id,
    mustChangePassword: updated.mustChangePassword,
  })
  res.json({ ok: true, token, role: 'OWNER', owner: { ...updated, passwordHash: undefined } })
})

export default router
