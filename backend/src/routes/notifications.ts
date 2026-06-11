import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN'))

const time = z.string().regex(/^\d{2}:\d{2}$/)

const NotifSettingsSchema = z.object({
  invoiceEnabled: z.boolean(),
  invoiceSendDay: z.number().int().min(1).max(28),
  invoiceSendTime: time,
  rentReminderEnabled: z.boolean(),
  rentReminderDays: z.array(z.number().int().min(1).max(30)),
  rentReminderTime: time,
  overdueEnabled: z.boolean(),
  overdueRepeatDays: z.number().int().min(1).max(7),
  overdueSendTime: time,
  contractEnabled: z.boolean(),
  contractReminderDays: z.array(z.number().int().min(1).max(90)),
  contractSendTime: time,
  notifyTenant: z.boolean(),
  maintEnabled: z.boolean(),
  maintUnackHours: z.number().int().min(1).max(24),
  quietEnabled: z.boolean(),
  quietStart: time,
  quietEnd: time,
})

// GET /api/notifications/settings
router.get('/settings', async (req, res) => {
  const adminId = req.user!.adminId!
  let settings = await prisma.notifSettings.findUnique({ where: { adminId } })
  if (!settings) {
    settings = await prisma.notifSettings.create({ data: { adminId } })
  }
  res.json(settings)
})

// PUT /api/notifications/settings
router.put('/settings', async (req, res) => {
  const parse = NotifSettingsSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const adminId = req.user!.adminId!
  const settings = await prisma.notifSettings.upsert({
    where: { adminId },
    create: { adminId, ...parse.data },
    update: parse.data,
  })
  res.json(settings)
})

export default router
