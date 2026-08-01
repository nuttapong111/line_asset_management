import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { DocumentTemplateType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole, JwtPayload } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import {
  createTemplate,
  ensureSingleDefault,
  parsePlacements,
  renderPreviewPdf,
  renderTemplatePdf,
} from '../services/documentTemplateService'
import { sampleValues, varsForType } from '../services/documentTemplateVars'
import { readFile, extractStorageKey } from '../services/storageService'

const router = Router()
router.use(authMiddleware, requireActiveSubscription, requireRole('ADMIN', 'OWNER'))

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('อัปโหลดได้เฉพาะ JPEG หรือ PNG'))
  },
})

async function assertCanAccessOwner(user: JwtPayload, ownerId: string): Promise<boolean> {
  if (user.role === 'OWNER') return user.ownerId === ownerId
  if (user.role === 'ADMIN' && user.adminId) {
    const o = await prisma.owner.findFirst({ where: { id: ownerId, adminId: user.adminId } })
    return !!o
  }
  return false
}

async function resolveOwnerId(user: JwtPayload, requested?: string | null): Promise<string | null> {
  if (user.role === 'OWNER') return user.ownerId ?? null
  if (user.role === 'ADMIN') {
    if (requested) {
      if (!(await assertCanAccessOwner(user, requested))) return null
      return requested
    }
    return null
  }
  return null
}

function serialize(t: {
  id: string
  ownerId: string
  propertyId: string | null
  type: DocumentTemplateType
  name: string
  backgroundUrl: string
  pageWidth: number
  pageHeight: number
  placements: unknown
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  property?: { id: string; name: string } | null
}) {
  return {
    id: t.id,
    ownerId: t.ownerId,
    propertyId: t.propertyId,
    propertyName: t.property?.name ?? null,
    type: t.type,
    name: t.name,
    pageWidth: t.pageWidth,
    pageHeight: t.pageHeight,
    placements: parsePlacements(t.placements),
    isDefault: t.isDefault,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    backgroundPath: `document-templates/${t.id}/background`,
  }
}

// GET /api/document-templates/vars?type=CONTRACT|RECEIPT
router.get('/vars', (req, res) => {
  const type = String(req.query.type || 'RECEIPT').toUpperCase()
  if (type !== 'CONTRACT' && type !== 'RECEIPT') {
    return res.status(400).json({ error: 'type must be CONTRACT or RECEIPT' })
  }
  res.json({ type, vars: varsForType(type), sample: sampleValues(type) })
})

// GET /api/document-templates?type=&ownerId=
router.get('/', async (req, res) => {
  const type = req.query.type ? String(req.query.type).toUpperCase() : undefined
  if (type && type !== 'CONTRACT' && type !== 'RECEIPT') {
    return res.status(400).json({ error: 'Invalid type' })
  }

  let ownerId = await resolveOwnerId(req.user!, req.query.ownerId as string | undefined)
  if (req.user!.role === 'OWNER' && !ownerId) {
    return res.status(403).json({ error: 'Owner not linked' })
  }

  // Admin without ownerId: list all templates under their owners
  const where =
    ownerId
      ? { ownerId, ...(type ? { type: type as DocumentTemplateType } : {}) }
      : {
          owner: { adminId: req.user!.adminId! },
          ...(type ? { type: type as DocumentTemplateType } : {}),
        }

  const list = await prisma.documentTemplate.findMany({
    where,
    include: { property: { select: { id: true, name: true } } },
    orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
  res.json(list.map(serialize))
})

// GET /api/document-templates/:id
router.get('/:id', async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({
    where: { id: req.params.id },
    include: { property: { select: { id: true, name: true } } },
  })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  res.json(serialize(t))
})

// GET /api/document-templates/:id/background
router.get('/:id/background', async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const { body, contentType } = await readFile(extractStorageKey(t.backgroundUrl))
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.send(body)
  } catch {
    res.status(404).json({ error: 'Background not found' })
  }
})

// POST /api/document-templates — multipart: file + fields
router.post('/', upload.single('file'), async (req, res) => {
  const schema = z.object({
    type: z.enum(['CONTRACT', 'RECEIPT']),
    name: z.string().min(1).max(120),
    ownerId: z.string().optional(),
    propertyId: z.string().optional().nullable(),
    pageWidth: z.coerce.number().positive(),
    pageHeight: z.coerce.number().positive(),
    isDefault: z
      .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
      .optional()
      .transform((v) => v === true || v === 'true' || v === '1'),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: 'ข้อมูลไม่ครบหรือไม่ถูกต้อง' })
  if (!req.file) return res.status(400).json({ error: 'กรุณาแนบไฟล์แบบฟอร์ม (รูปภาพ)' })

  const ownerId = await resolveOwnerId(req.user!, parse.data.ownerId)
  if (!ownerId) return res.status(400).json({ error: 'กรุณาเลือก Owner' })

  if (parse.data.propertyId) {
    const prop = await prisma.property.findFirst({
      where: { id: parse.data.propertyId, ownerId },
    })
    if (!prop) return res.status(400).json({ error: 'Property ไม่พบหรือไม่ได้ผูกกับ Owner นี้' })
  }

  const tpl = await createTemplate({
    ownerId,
    type: parse.data.type,
    name: parse.data.name,
    propertyId: parse.data.propertyId || null,
    background: req.file.buffer,
    mimeType: req.file.mimetype,
    pageWidth: parse.data.pageWidth,
    pageHeight: parse.data.pageHeight,
    isDefault: parse.data.isDefault ?? true,
  })

  const full = await prisma.documentTemplate.findUnique({
    where: { id: tpl.id },
    include: { property: { select: { id: true, name: true } } },
  })
  res.status(201).json(serialize(full!))
})

// PATCH /api/document-templates/:id
router.patch('/:id', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    placements: z
      .array(
        z.object({
          key: z.string(),
          x: z.number(),
          y: z.number(),
          fontSize: z.number().positive().optional(),
          align: z.enum(['left', 'center', 'right']).optional(),
          width: z.number().optional(),
          color: z.string().optional(),
        })
      )
      .optional(),
    isDefault: z.boolean().optional(),
    propertyId: z.string().nullable().optional(),
  })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })

  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  if (parse.data.propertyId) {
    const prop = await prisma.property.findFirst({
      where: { id: parse.data.propertyId, ownerId: t.ownerId },
    })
    if (!prop) return res.status(400).json({ error: 'Property ไม่ถูกต้อง' })
  }

  const updated = await prisma.documentTemplate.update({
    where: { id: t.id },
    data: {
      name: parse.data.name,
      placements: parse.data.placements
        ? (parsePlacements(parse.data.placements) as unknown as Prisma.InputJsonValue)
        : undefined,
      isDefault: parse.data.isDefault,
      propertyId: parse.data.propertyId === undefined ? undefined : parse.data.propertyId,
    },
    include: { property: { select: { id: true, name: true } } },
  })

  if (updated.isDefault) {
    await ensureSingleDefault(updated.ownerId, updated.type, updated.id, updated.propertyId)
  }

  res.json(serialize(updated))
})

// DELETE /api/document-templates/:id
router.delete('/:id', async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  await prisma.documentTemplate.delete({ where: { id: t.id } })
  res.json({ ok: true })
})

// POST /api/document-templates/:id/preview — returns PDF
router.post('/:id/preview', async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Allow preview with unsaved placements from body
  const placements = req.body?.placements ? parsePlacements(req.body.placements) : parsePlacements(t.placements)
  const values =
    req.body?.values && typeof req.body.values === 'object'
      ? { ...sampleValues(t.type), ...req.body.values }
      : sampleValues(t.type)

  try {
    const pdf = await renderTemplatePdf({ ...t, placements }, values)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="preview-${t.type.toLowerCase()}.pdf"`)
    res.send(pdf)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// GET preview of saved template as PDF (sample data)
router.get('/:id/preview.pdf', async (req, res) => {
  const t = await prisma.documentTemplate.findUnique({ where: { id: req.params.id } })
  if (!t) return res.status(404).json({ error: 'Not found' })
  if (!(await assertCanAccessOwner(req.user!, t.ownerId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const pdf = await renderPreviewPdf(t)
    res.setHeader('Content-Type', 'application/pdf')
    res.send(pdf)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router
