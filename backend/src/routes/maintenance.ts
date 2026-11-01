import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { authMiddleware, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere, maintenanceWhere } from '../lib/scope'
import { pushMaintNew, pushText } from '../lib/line/lineService'
import { notifyOwnersMaintenance } from '../services/ownerNotify'
import { uploadFile } from '../services/storageService'

const router = Router()
router.use(authMiddleware, requireActiveSubscription)

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

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

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('รองรับเฉพาะรูป JPEG, PNG หรือ WEBP'))
  },
})

function acceptPhotos(req: Request, res: Response, next: NextFunction) {
  photoUpload.array('photos', 4)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ' })
    next()
  })
}

// POST /api/maintenance
router.post('/', acceptPhotos, async (req, res) => {
  const parse = createSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const unitId = req.user!.role === 'TENANT' ? req.user!.unitId! : parse.data.unitId
  if (!unitId) return res.status(400).json({ error: 'unitId required' })

  // Managers may only file tickets for units within their scope
  const unitWhere =
    req.user!.role === 'TENANT'
      ? { id: unitId }
      : { id: unitId, property: propertyWhere(req.user!) }
  const unit = await prisma.unit.findFirst({
    where: unitWhere,
    include: { property: { include: { admin: true } }, tenants: { where: { isActive: true } } },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  const uploaded: string[] = []
  for (const [i, file] of files.entries()) {
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
    uploaded.push(await uploadFile(`maintenance/${unitId}/${Date.now()}-${i}.${ext}`, file.buffer, file.mimetype))
  }

  const ticketNo = await nextTicketNo(new Date().getFullYear())
  const ticket = await prisma.maintenance.create({
    data: {
      unitId,
      ticketNo,
      category: parse.data.category,
      title: parse.data.title,
      description: parse.data.description,
      photoUrls: [...(parse.data.photoUrls ?? []), ...uploaded],
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

  await notifyOwnersMaintenance({
    propertyId: unit.property.id,
    ticketNo: ticket.ticketNo,
    roomNumber: unit.roomNumber,
    title: ticket.title,
  })

  res.status(201).json(ticket)
})

// GET /api/maintenance
router.get('/', async (req, res) => {
  const where =
    req.user!.role === 'TENANT' ? { unitId: req.user!.unitId! } : maintenanceWhere(req.user!)
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
  const p = ticket.unit.property
  if (req.user!.role === 'TENANT' && ticket.unitId !== req.user!.unitId)
    return res.status(403).json({ error: 'Forbidden' })
  if (req.user!.role === 'ADMIN' && p.adminId !== req.user!.adminId)
    return res.status(403).json({ error: 'Forbidden' })
  if (req.user!.role === 'OWNER' && p.ownerId !== req.user!.ownerId)
    return res.status(403).json({ error: 'Forbidden' })
  res.json(ticket)
})

// Verify a ticket is within the manager's scope before mutating it
async function managerTicket(req: import('express').Request, id: string) {
  return prisma.maintenance.findFirst({
    where: { id, unit: { property: propertyWhere(req.user!) } },
  })
}

// PUT /api/maintenance/:id/status (manager)
router.put('/:id/status', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const schema = z.object({
    status: z.enum(['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED', 'DONE', 'CLOSED']),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  if (!(await managerTicket(req, req.params.id)))
    return res.status(404).json({ error: 'Ticket not found' })

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

// PUT /api/maintenance/:id/schedule (manager) — วันนัด ช่วงเวลา และช่าง
router.put('/:id/schedule', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const schema = z.object({
    scheduledAt: z.string(),
    scheduleSlot: z.string().optional(),
    technicianName: z.string().optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  if (!(await managerTicket(req, req.params.id)))
    return res.status(404).json({ error: 'Ticket not found' })
  const ticket = await prisma.maintenance.update({
    where: { id: req.params.id },
    data: {
      scheduledAt: new Date(parse.data.scheduledAt),
      scheduleSlot: parse.data.scheduleSlot,
      technicianName: parse.data.technicianName,
      status: 'SCHEDULED',
      appointmentStatus: null,
      appointmentNote: null,
    },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  const tenant = ticket.unit.tenants[0]
  if (tenant?.lineUserId) {
    const when = ticket.scheduledAt?.toLocaleDateString('th-TH') || ''
    await pushText(
      tenant.lineUserId,
      `นัดซ่อม ${ticket.ticketNo} วันที่ ${when}${ticket.scheduleSlot ? ` ช่วง ${ticket.scheduleSlot}` : ''}${ticket.technicianName ? ` ช่าง ${ticket.technicianName}` : ''}\nยืนยันหรือขอนัดใหม่ได้ในแอป`
    )
  }
  res.json(ticket)
})

// PUT /api/maintenance/:id/appointment — ผู้เช่ายืนยันหรือขอนัดใหม่
router.put('/:id/appointment', async (req, res) => {
  const schema = z.object({
    action: z.enum(['confirm', 'reschedule']),
    note: z.string().optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const ticket = await prisma.maintenance.findUnique({
    where: { id: req.params.id },
    include: { unit: { include: { property: { include: { owner: true, admin: true } } } } },
  })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (req.user!.role === 'TENANT' && ticket.unitId !== req.user!.unitId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const updated = await prisma.maintenance.update({
    where: { id: ticket.id },
    data: {
      appointmentStatus: parse.data.action === 'confirm' ? 'CONFIRMED' : 'RESCHEDULE',
      appointmentNote: parse.data.note,
      tenantRespondedAt: new Date(),
    },
  })
  const line = ticket.unit.property.owner?.lineUserId || ticket.unit.property.admin.lineUserId
  if (line) {
    const verb = parse.data.action === 'confirm' ? 'ยืนยันนัด' : 'ขอนัดใหม่'
    await pushText(line, `${verb} ใบงาน ${ticket.ticketNo}${parse.data.note ? `: ${parse.data.note}` : ''}`)
  }
  res.json(updated)
})

// PUT /api/maintenance/:id/confirm-done — ผู้เช่ายืนยันว่าซ่อมเสร็จ
router.put('/:id/confirm-done', async (req, res) => {
  const ticket = await prisma.maintenance.findUnique({ where: { id: req.params.id } })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (req.user!.role === 'TENANT' && ticket.unitId !== req.user!.unitId) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (ticket.status !== 'DONE' && ticket.status !== 'SCHEDULED' && ticket.status !== 'IN_PROGRESS') {
    return res.status(400).json({ error: 'ยังปิดงานไม่ได้' })
  }
  const updated = await prisma.maintenance.update({
    where: { id: ticket.id },
    data: { doneConfirmedAt: new Date(), status: 'DONE', completedAt: ticket.completedAt ?? new Date() },
  })
  res.json(updated)
})

// POST /api/maintenance/:id/messages
router.post('/:id/messages', async (req, res) => {
  const schema = z.object({ message: z.string().min(1) })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const ticket = await prisma.maintenance.findUnique({
    where: { id: req.params.id },
    include: { unit: { include: { property: true } } },
  })
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  const p = ticket.unit.property
  if (req.user!.role === 'TENANT' && ticket.unitId !== req.user!.unitId)
    return res.status(403).json({ error: 'Forbidden' })
  if (req.user!.role === 'ADMIN' && p.adminId !== req.user!.adminId)
    return res.status(403).json({ error: 'Forbidden' })
  if (req.user!.role === 'OWNER' && p.ownerId !== req.user!.ownerId)
    return res.status(403).json({ error: 'Forbidden' })

  const senderName =
    req.user!.role === 'TENANT' ? 'ผู้เช่า' : req.user!.role === 'OWNER' ? 'เจ้าของ' : 'แอดมิน'
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
