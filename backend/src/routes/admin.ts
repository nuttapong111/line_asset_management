import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { authMiddleware, signToken } from '../middleware/auth'

const router = Router()

// GET /api/admin/claim/enabled — does this deployment allow admin self-registration?
router.get('/claim/enabled', (_req, res) => {
  res.json({ enabled: Boolean(env.ADMIN_SETUP_CODE) })
})

// POST /api/admin/claim  { code, name? }
// Binds the currently logged-in LINE account as an Admin when the setup code matches.
router.post('/claim', authMiddleware, async (req, res) => {
  if (!env.ADMIN_SETUP_CODE) {
    return res.status(403).json({ error: 'ระบบยังไม่เปิดให้ลงทะเบียนผู้ดูแล (ยังไม่ได้ตั้ง ADMIN_SETUP_CODE)' })
  }
  const schema = z.object({ code: z.string().min(1), name: z.string().optional() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  if (parse.data.code.trim() !== env.ADMIN_SETUP_CODE) {
    return res.status(401).json({ error: 'รหัสลงทะเบียนไม่ถูกต้อง' })
  }

  const lineUserId = req.user!.lineUserId

  const existing = await prisma.admin.findUnique({ where: { lineUserId } })
  const admin =
    existing ??
    (await prisma.admin.create({
      data: {
        lineUserId,
        name: parse.data.name?.trim() || 'ผู้ดูแลระบบ',
        notifSettings: { create: {} },
      },
    }))

  const token = signToken({ lineUserId, role: 'ADMIN', adminId: admin.id })
  res.json({ ok: true, token, role: 'ADMIN', admin })
})

export default router
