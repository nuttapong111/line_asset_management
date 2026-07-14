import { Router } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env, isMockAuthAllowed } from '../lib/env'
import { signToken, JwtPayload, authMiddleware, requireRole } from '../middleware/auth'
import { setAdminRichMenu, setTenantRichMenu } from '../lib/line/richMenu'
import {
  hashPassword,
  verifyPassword,
  normalizeUsername,
  isValidUsername,
} from '../services/passwordService'

const router = Router()

const bodySchema = z.object({
  accessToken: z.string().optional(),
  profile: z
    .object({
      userId: z.string(),
      displayName: z.string().optional(),
      pictureUrl: z.string().optional(),
    })
    .optional(),
  mockRole: z.enum(['ADMIN', 'TENANT', 'OWNER', 'NEW']).optional(),
})

async function resolveRole(lineUserId: string): Promise<{ payload: JwtPayload; name: string; pictureUrl?: string }> {
  const admin = await prisma.admin.findUnique({ where: { lineUserId } })
  if (admin) {
    return {
      payload: {
        lineUserId,
        role: 'ADMIN',
        adminId: admin.id,
        mustChangePassword: admin.mustChangePassword,
      },
      name: admin.name,
    }
  }
  const tenant = await prisma.tenant.findUnique({ where: { lineUserId }, include: { unit: true } })
  if (tenant && tenant.isActive) {
    return {
      payload: { lineUserId, role: 'TENANT', unitId: tenant.unitId, tenantId: tenant.id },
      name: tenant.name,
    }
  }
  const owner = await prisma.owner.findFirst({ where: { lineUserId, linkedAt: { not: null } } })
  if (owner) {
    return {
      payload: {
        lineUserId,
        role: 'OWNER',
        ownerId: owner.id,
        mustChangePassword: owner.mustChangePassword,
      },
      name: owner.name,
    }
  }
  return { payload: { lineUserId, role: 'NEW' }, name: '' }
}

function authResponse(
  token: string,
  payload: JwtPayload,
  name: string,
  extra?: { pictureUrl?: string; username?: string | null; hasPassword?: boolean; lineLinked?: boolean }
) {
  return {
    token,
    role: payload.role,
    mustChangePassword: Boolean(payload.mustChangePassword),
    user: {
      lineUserId: payload.lineUserId || '',
      name,
      pictureUrl: extra?.pictureUrl,
      username: extra?.username || undefined,
      hasPassword: extra?.hasPassword,
      lineLinked: extra?.lineLinked ?? Boolean(payload.lineUserId),
    },
    unitId: payload.unitId,
    adminId: payload.adminId,
    ownerId: payload.ownerId,
  }
}

// POST /api/auth/line
router.post('/line', async (req, res) => {
  const parse = bodySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() })
  const { accessToken, profile, mockRole } = parse.data

  try {
    if (mockRole && isMockAuthAllowed) {
      let lineUserId: string
      if (mockRole === 'ADMIN') {
        const admin = await prisma.admin.findFirst({ where: { lineUserId: { not: null } } })
        lineUserId = admin?.lineUserId || 'mock_admin_001'
      } else if (mockRole === 'TENANT') {
        const tenant = await prisma.tenant.findFirst({ where: { isActive: true } })
        lineUserId = tenant?.lineUserId || 'mock_tenant_001'
      } else if (mockRole === 'OWNER') {
        const owner = await prisma.owner.findFirst({ where: { linkedAt: { not: null } } })
        lineUserId = owner?.lineUserId || 'mock_owner_001'
      } else {
        lineUserId = 'mock_new_user'
      }
      const { payload, name, pictureUrl } = await resolveRole(lineUserId)
      return res.json(authResponse(signToken(payload), payload, name || 'ผู้ใช้ใหม่', { pictureUrl }))
    }

    if (!accessToken || !profile) {
      return res.status(400).json({ error: 'accessToken and profile required' })
    }
    const verify = await axios.get('https://api.line.me/oauth2/v2.1/verify', {
      params: { access_token: accessToken },
    })
    if (env.LINE_LOGIN_CHANNEL_ID && verify.data.client_id !== env.LINE_LOGIN_CHANNEL_ID) {
      return res.status(401).json({ error: 'Channel ID mismatch' })
    }

    const lineUserId = profile.userId
    const { payload, name, pictureUrl } = await resolveRole(lineUserId)
    if (payload.role === 'ADMIN' || payload.role === 'OWNER') setAdminRichMenu(lineUserId).catch(() => {})
    else if (payload.role === 'TENANT') setTenantRichMenu(lineUserId).catch(() => {})

    let username: string | null = null
    let hasPassword = false
    if (payload.role === 'ADMIN' && payload.adminId) {
      const a = await prisma.admin.findUnique({ where: { id: payload.adminId } })
      username = a?.username || null
      hasPassword = Boolean(a?.passwordHash)
    } else if (payload.role === 'OWNER' && payload.ownerId) {
      const o = await prisma.owner.findUnique({ where: { id: payload.ownerId } })
      username = o?.username || null
      hasPassword = Boolean(o?.passwordHash)
    }

    return res.json(
      authResponse(signToken(payload), payload, name || profile.displayName || '', {
        pictureUrl: pictureUrl || profile.pictureUrl,
        username,
        hasPassword,
        lineLinked: true,
      })
    )
  } catch (err) {
    console.error('[auth] error', (err as Error).message)
    return res.status(401).json({ error: 'LINE token verification failed' })
  }
})

// POST /api/auth/login — portal username/password (ADMIN | OWNER)
router.post('/login', async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'กรุณากรอก Username และ Password' })

  const username = normalizeUsername(parse.data.username)
  const password = parse.data.password

  const admin = await prisma.admin.findUnique({ where: { username } })
  if (admin?.passwordHash) {
    const ok = await verifyPassword(password, admin.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' })
    const payload: JwtPayload = {
      lineUserId: admin.lineUserId || undefined,
      role: 'ADMIN',
      adminId: admin.id,
      mustChangePassword: admin.mustChangePassword,
    }
    return res.json(
      authResponse(signToken(payload), payload, admin.name, {
        username: admin.username,
        hasPassword: true,
        lineLinked: Boolean(admin.lineUserId),
      })
    )
  }

  const owner = await prisma.owner.findUnique({ where: { username } })
  if (owner?.passwordHash) {
    const ok = await verifyPassword(password, owner.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' })
    const payload: JwtPayload = {
      lineUserId: owner.lineUserId || undefined,
      role: 'OWNER',
      ownerId: owner.id,
      mustChangePassword: owner.mustChangePassword,
    }
    return res.json(
      authResponse(signToken(payload), payload, owner.name, {
        username: owner.username,
        hasPassword: true,
        lineLinked: Boolean(owner.lineUserId),
      })
    )
  }

  return res.status(401).json({ error: 'Username หรือ Password ไม่ถูกต้อง' })
})

// POST /api/auth/register-admin — first admin or additional admins with setup code (portal)
router.post('/register-admin', async (req, res) => {
  if (!env.ADMIN_SETUP_CODE) {
    return res.status(403).json({ error: 'ระบบยังไม่เปิดให้ลงทะเบียนผู้ดูแล (ยังไม่ได้ตั้ง ADMIN_SETUP_CODE)' })
  }
  const schema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    username: z.string().min(3),
    password: z.string().min(6),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'ข้อมูลไม่ครบ หรือรหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัว)' })
  if (parse.data.code.trim() !== env.ADMIN_SETUP_CODE) {
    return res.status(401).json({ error: 'รหัสลงทะเบียนไม่ถูกต้อง' })
  }
  if (!isValidUsername(parse.data.username)) {
    return res.status(400).json({ error: 'Username ใช้ได้เฉพาะตัวอักษร ตัวเลข . _ @ + - (3–64 ตัว)' })
  }

  const username = normalizeUsername(parse.data.username)
  const taken =
    (await prisma.admin.findUnique({ where: { username } })) ||
    (await prisma.owner.findUnique({ where: { username } }))
  if (taken) return res.status(409).json({ error: 'Username นี้ถูกใช้แล้ว' })

  const passwordHash = await hashPassword(parse.data.password)
  const admin = await prisma.admin.create({
    data: {
      name: parse.data.name.trim(),
      username,
      passwordHash,
      mustChangePassword: false,
      notifSettings: { create: {} },
    },
  })

  const payload: JwtPayload = {
    role: 'ADMIN',
    adminId: admin.id,
    mustChangePassword: false,
  }
  return res.status(201).json(
    authResponse(signToken(payload), payload, admin.name, {
      username: admin.username,
      hasPassword: true,
      lineLinked: false,
    })
  )
})

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const u = req.user!
  if (u.role === 'ADMIN' && u.adminId) {
    const admin = await prisma.admin.findUnique({ where: { id: u.adminId } })
    if (!admin) return res.status(404).json({ error: 'Admin not found' })
    return res.json({
      role: 'ADMIN',
      mustChangePassword: admin.mustChangePassword,
      user: {
        lineUserId: admin.lineUserId || '',
        name: admin.name,
        username: admin.username || undefined,
        hasPassword: Boolean(admin.passwordHash),
        lineLinked: Boolean(admin.lineUserId),
      },
      adminId: admin.id,
    })
  }
  if (u.role === 'OWNER' && u.ownerId) {
    const owner = await prisma.owner.findUnique({ where: { id: u.ownerId } })
    if (!owner) return res.status(404).json({ error: 'Owner not found' })
    return res.json({
      role: 'OWNER',
      mustChangePassword: owner.mustChangePassword,
      user: {
        lineUserId: owner.lineUserId || '',
        name: owner.name,
        username: owner.username || undefined,
        hasPassword: Boolean(owner.passwordHash),
        lineLinked: Boolean(owner.lineUserId),
      },
      ownerId: owner.id,
    })
  }
  return res.json({
    role: u.role,
    mustChangePassword: false,
    user: { lineUserId: u.lineUserId || '', name: '' },
    unitId: u.unitId,
    tenantId: u.tenantId,
  })
})

// POST /api/auth/password — set or change password (ADMIN | OWNER)
router.post('/password', authMiddleware, requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6),
    username: z.string().min(3).optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' })

  const u = req.user!
  const newHash = await hashPassword(parse.data.newPassword)

  if (u.role === 'ADMIN' && u.adminId) {
    const admin = await prisma.admin.findUnique({ where: { id: u.adminId } })
    if (!admin) return res.status(404).json({ error: 'Admin not found' })

    if (admin.passwordHash) {
      if (!parse.data.currentPassword) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
      const ok = await verifyPassword(parse.data.currentPassword, admin.passwordHash)
      if (!ok) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' })
    }

    let username = admin.username
    if (parse.data.username) {
      if (!isValidUsername(parse.data.username)) {
        return res.status(400).json({ error: 'Username ไม่ถูกต้อง' })
      }
      username = normalizeUsername(parse.data.username)
      if (username !== admin.username) {
        const taken =
          (await prisma.admin.findUnique({ where: { username } })) ||
          (await prisma.owner.findUnique({ where: { username } }))
        if (taken) return res.status(409).json({ error: 'Username นี้ถูกใช้แล้ว' })
      }
    }
    if (!username) return res.status(400).json({ error: 'กรุณาตั้ง Username' })

    const updated = await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: newHash, username, mustChangePassword: false },
    })
    const payload: JwtPayload = {
      lineUserId: updated.lineUserId || undefined,
      role: 'ADMIN',
      adminId: updated.id,
      mustChangePassword: false,
    }
    return res.json(
      authResponse(signToken(payload), payload, updated.name, {
        username: updated.username,
        hasPassword: true,
        lineLinked: Boolean(updated.lineUserId),
      })
    )
  }

  if (u.role === 'OWNER' && u.ownerId) {
    const owner = await prisma.owner.findUnique({ where: { id: u.ownerId } })
    if (!owner) return res.status(404).json({ error: 'Owner not found' })

    if (owner.passwordHash) {
      if (!parse.data.currentPassword && !owner.mustChangePassword) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
      }
      if (parse.data.currentPassword) {
        const ok = await verifyPassword(parse.data.currentPassword, owner.passwordHash)
        if (!ok) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' })
      } else if (!owner.mustChangePassword) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
      }
    }

    let username = owner.username
    if (parse.data.username) {
      if (!isValidUsername(parse.data.username)) {
        return res.status(400).json({ error: 'Username ไม่ถูกต้อง' })
      }
      username = normalizeUsername(parse.data.username)
      if (username !== owner.username) {
        const taken =
          (await prisma.admin.findUnique({ where: { username } })) ||
          (await prisma.owner.findUnique({ where: { username } }))
        if (taken) return res.status(409).json({ error: 'Username นี้ถูกใช้แล้ว' })
      }
    }
    if (!username) return res.status(400).json({ error: 'กรุณาตั้ง Username' })

    const updated = await prisma.owner.update({
      where: { id: owner.id },
      data: { passwordHash: newHash, username, mustChangePassword: false },
    })
    const payload: JwtPayload = {
      lineUserId: updated.lineUserId || undefined,
      role: 'OWNER',
      ownerId: updated.id,
      mustChangePassword: false,
    }
    return res.json(
      authResponse(signToken(payload), payload, updated.name, {
        username: updated.username,
        hasPassword: true,
        lineLinked: Boolean(updated.lineUserId),
      })
    )
  }

  return res.status(403).json({ error: 'Forbidden' })
})

export default router
