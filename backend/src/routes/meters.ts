import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

const meterSchema = z.object({
  unitId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  prevElec: z.number().nonnegative(),
  currElec: z.number().nonnegative(),
  prevWater: z.number().nonnegative(),
  currWater: z.number().nonnegative(),
  elecPhotoUrl: z.string().optional(),
  waterPhotoUrl: z.string().optional(),
})

// POST /api/meters (admin)
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const parse = meterSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: { adminId: req.user!.adminId! } },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const existing = await prisma.meterReading.findFirst({
    where: { unitId: parse.data.unitId, month: parse.data.month, year: parse.data.year },
  })
  if (existing) return res.status(409).json({ error: 'Meter reading for this month already exists' })

  const reading = await prisma.meterReading.create({ data: parse.data })
  res.status(201).json({
    ...reading,
    usedElec: Number(reading.currElec) - Number(reading.prevElec),
    usedWater: Number(reading.currWater) - Number(reading.prevWater),
  })
})

// GET /api/meters/:unitId
router.get('/:unitId', async (req, res) => {
  const readings = await prisma.meterReading.findMany({
    where: { unitId: req.params.unitId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(readings)
})

// GET /api/meters/:unitId/latest
router.get('/:unitId/latest', async (req, res) => {
  const reading = await prisma.meterReading.findFirst({
    where: { unitId: req.params.unitId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(reading)
})

export default router
