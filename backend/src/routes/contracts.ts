import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { requireActiveSubscription } from '../middleware/subscriptionGuard'
import { propertyWhere } from '../lib/scope'
import { uploadFile, readFile, extractStorageKey } from '../services/storageService'
import { moveOutByContractId } from '../services/tenantLifecycle'
import { generateAndStoreContractPdf } from '../services/contractPdfService'

const router = Router()
router.use(authMiddleware, requireActiveSubscription)

const signedUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG, PNG, or PDF allowed'))
  },
})

function extForMime(mime: string) {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  return 'jpg'
}

async function buildContractPdf(contract: NonNullable<Awaited<ReturnType<typeof loadContract>>>) {
  return generateAndStoreContractPdf(contract)
}

const contractSchema = z.object({
  tenantId: z.string().min(1),
  unitId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  rentAmount: z.number().nonnegative(),
  deposit: z.number().nonnegative(),
  lateFeePerDay: z.number().nonnegative().optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  terms: z.string().optional(),
})

// POST /api/contracts (manager)
router.post('/', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const parse = contractSchema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const unit = await prisma.unit.findFirst({
    where: { id: parse.data.unitId, property: propertyWhere(req.user!) },
  })
  if (!unit) return res.status(404).json({ error: 'Unit not found' })

  const contract = await prisma.contract.create({
    data: {
      tenantId: parse.data.tenantId,
      unitId: parse.data.unitId,
      startDate: new Date(parse.data.startDate),
      endDate: new Date(parse.data.endDate),
      rentAmount: parse.data.rentAmount,
      deposit: parse.data.deposit,
      lateFeePerDay: parse.data.lateFeePerDay ?? 30,
      dueDay: parse.data.dueDay ?? 5,
      terms: parse.data.terms,
    },
  })
  res.status(201).json(contract)
})

// GET /api/contracts/me — current tenant's active contract
router.get('/me', async (req, res) => {
  if (req.user!.role !== 'TENANT' || !req.user!.unitId) {
    return res.status(404).json({ error: 'No contract' })
  }
  const contract = await prisma.contract.findFirst({
    where: { unitId: req.user!.unitId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    include: { tenant: true, unit: { include: { property: true } } },
  })
  if (!contract) return res.status(404).json({ error: 'No contract' })
  res.json(contract)
})

async function loadContract(
  id: string,
  user: { role: string; adminId?: string; unitId?: string; ownerId?: string }
) {
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      tenant: true,
      unit: { include: { property: { include: { admin: true, owner: true } } } },
    },
  })
  if (!contract) return null
  if (user.role === 'ADMIN' && contract.unit.property.adminId !== user.adminId) return null
  if (user.role === 'OWNER' && contract.unit.property.ownerId !== user.ownerId) return null
  if (user.role === 'TENANT' && contract.unitId !== user.unitId) return null
  return contract
}

// GET /api/contracts/:id/pdf — download (streams from private S3 via API)
router.get('/:id/pdf', async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })

  let key = contract.pdfUrl ? extractStorageKey(contract.pdfUrl) : `contracts/${contract.id}.pdf`
  let file: { body: Buffer; contentType: string }
  try {
    file = await readFile(key)
  } catch {
    // PDF not generated yet — create on first download
    const built = await buildContractPdf(contract)
    key = extractStorageKey(built.stored)
    file = { body: built.pdf, contentType: 'application/pdf' }
  }

  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Content-Disposition', `inline; filename="contract-${contract.id}.pdf"`)
  res.send(file.body)
})

// POST /api/contracts/:id/signed — upload scanned/photo of signed contract (manager)
router.post('/:id/signed', requireRole('ADMIN', 'OWNER'), signedUpload.single('file'), async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const ext = extForMime(req.file.mimetype)
  const key = `contracts/${contract.id}/signed-${Date.now()}.${ext}`
  const signedDocumentUrl = await uploadFile(key, req.file.buffer, req.file.mimetype)
  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { signedDocumentUrl, signedAt: new Date() },
  })
  res.json(updated)
})

// GET /api/contracts/:id/signed — view signed copy (private storage via API)
router.get('/:id/signed', async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  if (!contract.signedDocumentUrl) return res.status(404).json({ error: 'No signed document' })

  const key = extractStorageKey(contract.signedDocumentUrl)
  const file = await readFile(key)
  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Content-Disposition', `inline; filename="contract-${contract.id}-signed"`)
  res.send(file.body)
})

// DELETE /api/contracts/:id/signed — remove signed copy to re-upload (manager)
router.delete('/:id/signed', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { signedDocumentUrl: null, signedAt: null },
  })
  res.json(updated)
})

// GET /api/contracts/:id
router.get('/:id', async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  res.json(contract)
})

// POST /api/contracts/:id/pdf — regenerate PDF
router.post('/:id/pdf', async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })

  const { contractNo } = await buildContractPdf(contract)
  res.json({ ok: true, contractNo, downloadUrl: `/api/contracts/${contract.id}/pdf` })
})

// PUT /api/contracts/:id/renew (manager)
router.put('/:id/renew', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  const schema = z.object({ endDate: z.string() })
  const parse = schema.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() })
  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { endDate: new Date(parse.data.endDate), status: 'ACTIVE' },
  })
  res.json(updated)
})

// PUT /api/contracts/:id/terminate (manager) — tenant moves out
router.put('/:id/terminate', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  try {
    await moveOutByContractId(contract.id)
    const updated = await prisma.contract.findUnique({ where: { id: contract.id } })
    res.json(updated)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Terminate failed'
    res.status(400).json({ error: msg })
  }
})

export default router
