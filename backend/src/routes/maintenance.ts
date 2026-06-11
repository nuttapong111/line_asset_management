import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { authMiddleware, requireRole } from '../middleware/auth'
import { pushMaintNew, pushText } from '../lib/line/lineService'

const router = Router()
router.use(authMiddleware)

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

async function nextTicketNo(year: number): Promise<string> {
  const count = await prisma.maintenance.count({ where: { ticketNo: { startsWith: `MT-${year}-` } } })
  return `MT-${year}-${String(count + 1).padStart(5, '0')}`
}

const createSchema = z.object({
  unitId: z.string().optional(),
  category: z.enum(['ELECTRIC', 'PLUMBING', 'APPLIANCE', 'GENERAL']),
  title: z.string().min(1),
  description: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
})

// POST /api/maintenance
router.post('/', async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const unitId = req.user!.role === 'TENANT' ? req.user!.unitId! : parse.data.unitId
  if (!unitId) return res.status(400).json({ error: 'unitId required' })

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { include: { admin: true } }, tenants: { where: { isActive: true } } },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const ticketNo = await nextTicketNo(new Date().getFullYear())
  const ticket = await prisma.maintenance.create({
    data: {
      unitId,
      ticketNo,
      category: parse.data.category,
      title: parse.data.title,
      description: parse.data.description,
      photoUrls: parse.data.photoUrls ?? [],
    },
  })

  const adminLine = unit.property.admin.lineUserId
  if (adminLine) {
    await pushMaintNew(adminLine, {
      ticketId: ticket.id,
      ticketNo: ticket.ticketNo,
      title: ticket.title,
      roomNumber: unit.roomNumber,
      tenantName: unit.tenants[0]?.name || '-',
      category: ticket.category,
      createdAt: ticket.createdAt.toLocaleString('th-TH'),
      viewUrl: liff(`/admin/maintenance/${ticket.id}`),
    })
  }
  res.status(201).json(ticket)
})

// GET /api/maintenance
router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'ADMIN'
      ? { unit: { property: { adminId: req.user!.adminId! } } }
      : { unitId: req.user!.unitId! }
  const tickets = await prisma.maintenance.findMany({
    where,
    include: { unit: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(tickets)
})

// GET /api/maintenance/:id
router.get('/:id', async (req, res) => {
  const ticket = await prisma.maintenance.findUnique({
    where: { id: req.params.id },
    include: { unit: { include: { property: true } }, messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  res.json(ticket)
})

// PUT /api/maintenance/:id/status (admin)
router.put('/:id/status', requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({
    status: z.enum(['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED', 'DONE', 'CLOSED']),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const ticket = await prisma.maintenance.update({
    where: { id: req.params.id },
    data: {
      status: parse.data.status,
      completedAt: parse.data.status === 'DONE' ? new Date() : undefined,
    },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })

  const tenant = ticket.unit.tenants[0]
  if (tenant?.lineUserId) {
    const statusTH: Record<string, string> = {
      ACKNOWLEDGED: 'รับเรื่องแล้ว',
      IN_PROGRESS: 'กำลังดำเนินการ',
      SCHEDULED: 'นัดหมายแล้ว',
      DONE: 'ซ่อมเสร็จแล้ว',
      CLOSED: 'ปิดงาน',
      NEW: 'แจ้งใหม่',
    }
    await pushText(
      tenant.lineUserId,
      `🔧 แจ้งซ่อม ${ticket.ticketNo}: สถานะอัปเดตเป็น "${statusTH[parse.data.status]}"`
    )
  }
  res.json(ticket)
})

// PUT /api/maintenance/:id/schedule (admin)
router.put('/:id/schedule', requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({ scheduledAt: z.string() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const ticket = await prisma.maintenance.update({
    where: { id: req.params.id },
    data: { scheduledAt: new Date(parse.data.scheduledAt), status: 'SCHEDULED' },
  })
  res.json(ticket)
})

// POST /api/maintenance/:id/messages
router.post('/:id/messages', async (req, res) => {
  const schema = z.object({ message: z.string().min(1) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const ticket = await prisma.maintenance.findUnique({ where: { id: req.params.id } })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const senderName = req.user!.role === 'ADMIN' ? 'แอดมิน' : 'ผู้เช่า'
  const msg = await prisma.maintenanceMessage.create({
    data: {
      maintenanceId: ticket.id,
      senderRole: req.user!.role,
      senderName,
      message: parse.data.message,
    },
  })
  res.status(201).json(msg)
})

export default router
