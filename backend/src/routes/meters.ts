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

function meterWarnings(
  history: { prevElec: unknown; currElec: unknown; prevWater: unknown; currWater: unknown }[],
  prevElec: number,
  currElec: number,
  prevWater: number,
  currWater: number
) {
  const warnings: { field: 'elec' | 'water'; level: 'danger' | 'warn'; message: string }[] = []
  if (currElec < prevElec) {
    warnings.push({ field: 'elec', level: 'danger', message: 'เลขไฟปัจจุบันน้อยกว่าเลขก่อนหน้า' })
  }
  if (currWater < prevWater) {
    warnings.push({ field: 'water', level: 'danger', message: 'เลขน้ำปัจจุบันน้อยกว่าเลขก่อนหน้า' })
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const elecAvg = avg(history.slice(0, 3).map((h) => Math.max(0, Number(h.currElec) - Number(h.prevElec))))
  const waterAvg = avg(history.slice(0, 3).map((h) => Math.max(0, Number(h.currWater) - Number(h.prevWater))))
  const elecUse = currElec - prevElec
  const waterUse = currWater - prevWater
  if (elecAvg > 0 && elecUse > elecAvg * 2) {
    warnings.push({
      field: 'elec',
      level: 'warn',
      message: `ไฟใช้ ${elecUse} หน่วย สูงกว่าค่าเฉลี่ย 3 เดือน (${Math.round(elecAvg)}) เกิน 2 เท่า`,
    })
  }
  if (waterAvg > 0 && waterUse > waterAvg * 2) {
    warnings.push({
      field: 'water',
      level: 'warn',
      message: `น้ำใช้ ${waterUse} หน่วย สูงกว่าค่าเฉลี่ย 3 เดือน (${Math.round(waterAvg)}) เกิน 2 เท่า`,
    })
  }
  return warnings
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

// GET /api/meters/:unitId/anomaly?prevElec&currElec&prevWater&currWater
router.get('/:unitId/anomaly', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  if (!(await readableUnit(req, req.params.unitId))) return res.status(404).json({ error: 'Unit not found' })
  const q = z
    .object({
      prevElec: z.coerce.number(),
      currElec: z.coerce.number(),
      prevWater: z.coerce.number(),
      currWater: z.coerce.number(),
    })
    .safeParse(req.query)
  if (!q.success) return res.status(400).json({ error: q.error.flatten() })
  const history = await prisma.meterReading.findMany({
    where: { unitId: req.params.unitId },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 3,
  })
  res.json({
    warnings: meterWarnings(history, q.data.prevElec, q.data.currElec, q.data.prevWater, q.data.currWater),
  })
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
