import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere, resolveAdminId } from '../lib/scope'
import { uploadFile } from '../services/storageService'

const router = Router()
// Both admins and owners manage properties (owners are scoped to their own)
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG/PNG allowed'))
  },
})

const propertySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  promptpayNumber: z.string().min(1),
  paymentQrUrl: z.string().optional(),
  ownerId: z.string().optional(), // admin may assign an owner
})

// POST /api/properties
router.post('/', async (req, res) => {
  const parse = propertySchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const adminId = await resolveAdminId(prisma, req.user!)
  if (!adminId) return res.status(400).json({ error: 'ไม่พบบัญชีผู้ดูแลที่เกี่ยวข้อง' })

  // Owners always create under themselves; admins may set ownerId (optional)
  const ownerId = req.user!.role === 'OWNER' ? req.user!.ownerId! : parse.data.ownerId || null
  const { ownerId: _omit, ...data } = parse.data
  const property = await prisma.property.create({
    data: { ...data, adminId, ownerId },
  })
  res.status(201).json(property)
})

// GET /api/properties
router.get('/', async (req, res) => {
  const props = await prisma.property.findMany({
    where: propertyWhere(req.user!),
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
      paymentQrUrl: p.paymentQrUrl,
      ownerId: p.ownerId,
      stats: { total, occupied, tenants, overdue, monthlyRevenue },
    }
  })
  res.json(result)
})

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, ...propertyWhere(req.user!) },
    include: {
      units: {
        include: {
          tenants: { where: { isActive: true } },
          invoices: { orderBy: { createdAt: 'desc' }, take: 1 },
          contracts: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
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
  const existing = await prisma.property.findFirst({ where: { id: req.params.id, ...propertyWhere(req.user!) } })
  if (!existing) return res.status(404).json({ error: 'Property not found' })
  // Owners cannot reassign ownership
  const data = { ...parse.data }
  if (req.user!.role === 'OWNER') delete data.ownerId
  const updated = await prisma.property.update({ where: { id: req.params.id }, data })
  res.json(updated)
})

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, ...propertyWhere(req.user!) },
    include: { units: { include: { tenants: { where: { isActive: true } } } } },
  })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  const hasTenants = property.units.some((u) => u.tenants.length > 0)
  if (hasTenants) return res.status(400).json({ error: 'Cannot delete property with active tenants' })
  await prisma.unit.deleteMany({ where: { propertyId: property.id } })
  await prisma.property.delete({ where: { id: property.id } })
  res.json({ ok: true })
})

// POST /api/properties/:id/payment-qr — upload a static QR image for transfers
router.post('/:id/payment-qr', upload.single('file'), async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, ...propertyWhere(req.user!) } })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const key = `payment-qr/${property.id}/${Date.now()}.${req.file.mimetype === 'image/png' ? 'png' : 'jpg'}`
  const url = await uploadFile(key, req.file.buffer, req.file.mimetype)
  const updated = await prisma.property.update({ where: { id: property.id }, data: { paymentQrUrl: url } })
  res.json({ paymentQrUrl: updated.paymentQrUrl })
})

// DELETE /api/properties/:id/payment-qr — remove the static QR image
router.delete('/:id/payment-qr', async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, ...propertyWhere(req.user!) } })
  if (!property) return res.status(404).json({ error: 'Property not found' })
  await prisma.property.update({ where: { id: property.id }, data: { paymentQrUrl: null } })
  res.json({ ok: true })
})

export default router
