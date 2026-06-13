import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'
import { generateContractPdf } from '../services/pdfService'
import { uploadFile, readFile, extractStorageKey } from '../services/storageService'

const router = Router()
router.use(authMiddleware)

async function buildContractPdf(contract: NonNullable<Awaited<ReturnType<typeof loadContract>>>) {
  const year = contract.startDate.getFullYear()
  const seq = (await prisma.contract.count({ where: { createdAt: { lte: contract.createdAt } } })) || 1
  const contractNo = `CTR-${year}-${String(seq).padStart(5, '0')}`

  const pdf = await generateContractPdf({
    contractNo,
    landlordName: contract.unit.property.admin.name,
    propertyName: contract.unit.property.name,
    propertyAddress: contract.unit.property.address || '-',
    roomNumber: contract.unit.roomNumber,
    floor: contract.unit.floor,
    tenantName: contract.tenant.name,
    tenantIdCard: contract.tenant.idCardNumber,
    tenantPhone: contract.tenant.phone,
    rentAmount: Number(contract.rentAmount),
    deposit: Number(contract.deposit),
    dueDay: contract.dueDay,
    lateFeePerDay: Number(contract.lateFeePerDay),
    startDate: contract.startDate,
    endDate: contract.endDate,
    terms: contract.terms,
  })
  const stored = await uploadFile(`contracts/${contract.id}.pdf`, pdf, 'application/pdf')
  await prisma.contract.update({ where: { id: contract.id }, data: { pdfUrl: stored } })
  return { pdf, contractNo, stored }
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
    include: { tenant: true, unit: { include: { property: { include: { admin: true } } } } },
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

// PUT /api/contracts/:id/terminate (manager)
router.put('/:id/terminate', requireRole('ADMIN', 'OWNER'), async (req, res) => {
  const contract = await loadContract(req.params.id, req.user!)
  if (!contract) return res.status(404).json({ error: 'Contract not found' })
  const updated = await prisma.contract.update({
    where: { id: contract.id },
    data: { status: 'TERMINATED' },
  })
  res.json(updated)
})

export default router
