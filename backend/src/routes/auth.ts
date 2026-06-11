import { Router } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env, isMockAuthAllowed } from '../lib/env'
import { signToken, JwtPayload } from '../middleware/auth'

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
  mockRole: z.enum(['ADMIN', 'TENANT', 'NEW']).optional(),
})

async function resolveRole(lineUserId: string): Promise<{ payload: JwtPayload; name: string; pictureUrl?: string }> {
  const admin = await prisma.admin.findUnique({ where: { lineUserId } })
  if (admin) {
    return { payload: { lineUserId, role: 'ADMIN', adminId: admin.id }, name: admin.name }
  }
  const tenant = await prisma.tenant.findUnique({ where: { lineUserId }, include: { unit: true } })
  if (tenant && tenant.isActive) {
    return {
      payload: { lineUserId, role: 'TENANT', unitId: tenant.unitId, tenantId: tenant.id },
      name: tenant.name,
    }
  }
  return { payload: { lineUserId, role: 'NEW' }, name: '' }
}

// POST /api/auth/line
router.post('/line', async (req, res) => {
  const parse = bodySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'Invalid body', details: parse.error.flatten() })
  const { accessToken, profile, mockRole } = parse.data

  try {
    // ---- Mock mode ----
    if (mockRole && isMockAuthAllowed) {
      let lineUserId: string
      if (mockRole === 'ADMIN') {
        const admin = await prisma.admin.findFirst()
        lineUserId = admin?.lineUserId || 'mock_admin_001'
      } else if (mockRole === 'TENANT') {
        const tenant = await prisma.tenant.findFirst({ where: { isActive: true } })
        lineUserId = tenant?.lineUserId || 'mock_tenant_001'
      } else {
        lineUserId = 'mock_new_user'
      }
      const { payload, name, pictureUrl } = await resolveRole(lineUserId)
      return res.json({
        token: signToken(payload),
        role: payload.role,
        user: { lineUserId, name: name || 'ผู้ใช้ใหม่', pictureUrl },
      })
    }

    // ---- Real LINE verification ----
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
    return res.json({
      token: signToken(payload),
      role: payload.role,
      user: { lineUserId, name: name || profile.displayName || '', pictureUrl: pictureUrl || profile.pictureUrl },
    })
  } catch (err) {
    console.error('[auth] error', (err as Error).message)
    return res.status(401).json({ error: 'LINE token verification failed' })
  }
})

export default router
