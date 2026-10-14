import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'))

const time = z.string().regex(/^\d{2}:\d{2}$/)

const sharedFields = {
  invoiceEnabled: z.boolean(),
  /** Days before each contract's dueDay to create+send rent invoice */
  invoiceDaysBeforeDue: z.number().int().min(0).max(28),
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
}

const NotifSettingsSchema = z.object(sharedFields)

function publicSettings(
  row: Record<string, unknown>,
  scope: 'OWNER' | 'ADMIN'
) {
  return {
    scope,
    invoiceEnabled: row.invoiceEnabled,
    invoiceDaysBeforeDue: row.invoiceDaysBeforeDue ?? 4,
    invoiceSendTime: row.invoiceSendTime,
    rentReminderEnabled: row.rentReminderEnabled,
    rentReminderDays: row.rentReminderDays,
    rentReminderTime: row.rentReminderTime,
    overdueEnabled: row.overdueEnabled,
    overdueRepeatDays: row.overdueRepeatDays,
    overdueSendTime: row.overdueSendTime,
    contractEnabled: row.contractEnabled,
    contractReminderDays: row.contractReminderDays,
    contractSendTime: row.contractSendTime,
    notifyTenant: row.notifyTenant,
    maintEnabled: row.maintEnabled,
    maintUnackHours: row.maintUnackHours,
    quietEnabled: row.quietEnabled,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  }
}

// GET /api/notifications/settings
router.get('/settings', async (req, res) => {
  if (req.user!.role === 'OWNER') {
    const ownerId = req.user!.ownerId!
    let settings = await prisma.ownerNotifSettings.findUnique({ where: { ownerId } })
    if (!settings) {
      settings = await prisma.ownerNotifSettings.create({ data: { ownerId } })
    }
    return res.json(publicSettings(settings as unknown as Record<string, unknown>, 'OWNER'))
  }

  const adminId = req.user!.adminId!
  let settings = await prisma.notifSettings.findUnique({ where: { adminId } })
  if (!settings) {
    settings = await prisma.notifSettings.create({ data: { adminId } })
  }
  res.json(publicSettings(settings as unknown as Record<string, unknown>, 'ADMIN'))
})

// PUT /api/notifications/settings
router.put('/settings', async (req, res) => {
  const parse = NotifSettingsSchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  if (req.user!.role === 'OWNER') {
    const ownerId = req.user!.ownerId!
    const settings = await prisma.ownerNotifSettings.upsert({
      where: { ownerId },
      create: { ownerId, ...parse.data },
      update: parse.data,
    })
    return res.json(publicSettings(settings as unknown as Record<string, unknown>, 'OWNER'))
  }

  const adminId = req.user!.adminId!
  const settings = await prisma.notifSettings.upsert({
    where: { adminId },
    create: { adminId, ...parse.data },
    update: parse.data,
  })
  res.json(publicSettings(settings as unknown as Record<string, unknown>, 'ADMIN'))
})

export default router
