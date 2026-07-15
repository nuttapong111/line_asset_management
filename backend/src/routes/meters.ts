import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere } from '../lib/scope'

const router = Router()
router.use(authMiddleware, requireActiveSubscription)

// A unit the current user is allowed to read meter data for
async function readableUnit(req: import('express').Request, unitId: string) {
  if (req.user!.role === 'TENANT') {
    return req.user!.unitId === unitId
      ? prisma.unit.findUnique({ where: { id: unitId } })
      : null
  }
  return prisma.unit.findFirst({ where: { id: unitId, property: propertyWhere(req.user!) } })
}

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

// POST /api/meters (manager)
router.post('/', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = meterSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: propertyWhere(req.user!) },
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
  if (!(await readableUnit(req, req.params.unitId))) {
    return res.status(404).json({ error: 'Unit not found' })
  }
  const readings = await prisma.meterReading.findMany({
    where: { unitId: req.params.unitId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(readings)
})

// GET /api/meters/:unitId/latest
router.get('/:unitId/latest', async (req, res) => {
  if (!(await readableUnit(req, req.params.unitId))) {
    return res.status(404).json({ error: 'Unit not found' })
  }
  const reading = await prisma.meterReading.findFirst({
    where: { unitId: req.params.unitId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  res.json(reading)
})

export default router
