import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN'))

const propertySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  promptpayNumber: z.string().min(1),
})

// POST /api/properties
router.post('/', async (req, res) => {
  const parse = propertySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const property = await prisma.property.create({
    data: { ...parse.data, adminId: req.user!.adminId! },
  })
  res.status(201).json(property)
})

// GET /api/properties
router.get('/', async (req, res) => {
  const props = await prisma.property.findMany({
    where: { adminId: req.user!.adminId! },
    include: { units: { include: { tenants: { where: { isActive: true } }, invoices: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const result = props.map((p) => {
    const total = p.units.length
    const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length
    const tenants = p.units.reduce((acc, u) => acc + u.tenants.length, 0)
    const overdue = p.units.reduce(
      (acc, u) => acc + u.invoices.filter((i) => i.status === 'OVERDUE').length,
      0
    )
    const monthlyRevenue = p.units.reduce((acc, u) => acc + Number(u.rentPrice), 0)
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      bankName: p.bankName,
      bankAccount: p.bankAccount,
      promptpayNumber: p.promptpayNumber,
      stats: { total, occupied, tenants, overdue, monthlyRevenue },
    }
  })
  res.json(result)
})

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, adminId: req.user!.adminId! },
    include: {
      units: {
        include: {
          tenants: { where: { isActive: true } },
          invoices: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { roomNumber: 'asc' },
      },
    },
  })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  res.json(property)
})

// PUT /api/properties/:id
router.put('/:id', async (req, res) => {
  const parse = propertySchema.partial().safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const existing = await prisma.property.findFirst({ where: { id: req.params.id, adminId: req.user!.adminId! } })
  if (!existing) return res.status(404).json({ error: 'Property not found' })
  const updated = await prisma.property.update({ where: { id: req.params.id }, data: parse.data })
  res.json(updated)
})

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, adminId: req.user!.adminId! },
    include: { units: { include: { tenants: { where: { isActive: true } } } } },
  })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const hasTenants = property.units.some((u) => u.tenants.length > 0)
  if (hasTenants) return res.status(400).json({ error: 'Cannot delete property with active tenants' })
  await prisma.unit.deleteMany({ where: { propertyId: property.id } })
  await prisma.property.delete({ where: { id: property.id } })
  res.json({ ok: true })
})

export default router
