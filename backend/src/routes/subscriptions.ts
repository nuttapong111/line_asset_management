import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import {
  approveSubscriptionPayment,
  ensureSubscriptionBill,
  getSubscriptionSummary,
  readSubscriptionSlip,
  rejectSubscriptionPayment,
  uploadSubscriptionSlip,
} from '../services/subscriptionService'

const router = Router()
router.use(authMiddleware)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only JPEG/PNG allowed'))
  },
})

// GET /api/subscriptions/me — owner (or admin viewing as support later)
router.get('/me', requireRole('OWNER'), async (req, res) => {
  const summary = await getSubscriptionSummary(req.user!.ownerId!)
  if (!summary) return res.status(404).json({ error: 'Owner not found' })
  res.json(summary)
})

// POST /api/subscriptions/me/bill — ensure open bill
router.post('/me/bill', requireRole('OWNER'), async (req, res) => {
  const bill = await ensureSubscriptionBill(req.user!.ownerId!)
  res.json(bill)
})

// POST /api/subscriptions/:id/slip — owner upload slip
router.post('/:id/slip', requireRole('OWNER'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์สลิป' })
  try {
    const payment = await uploadSubscriptionSlip(req.user!.ownerId!, req.params.id, req.file)
    res.json({ ok: true, payment: { id: payment.id, status: payment.status, billNo: payment.billNo } })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/subscriptions — admin: list under-review + recent
router.get('/', requireRole('ADMIN'), async (req, res) => {
  const adminId = req.user!.adminId!
  const items = await prisma.subscriptionPayment.findMany({
    where: { owner: { adminId } },
    include: { owner: { select: { id: true, name: true, subscriptionStatus: true, expiresAt: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(
    items.map((p) => ({
      id: p.id,
      billNo: p.billNo,
      amount: Number(p.amount),
      periodDays: p.periodDays,
      status: p.status,
      slipUploadedAt: p.slipUploadedAt,
      rejectReason: p.rejectReason,
      extendsTo: p.extendsTo,
      createdAt: p.createdAt,
      owner: p.owner,
    }))
  )
})

// GET /api/subscriptions/:id/slip — admin stream slip image
router.get('/:id/slip', requireRole('ADMIN'), async (req, res) => {
  const file = await readSubscriptionSlip(req.params.id, req.user!.adminId!)
  if (!file) return res.status(404).json({ error: 'Slip not found' })
  res.setHeader('Content-Type', file.contentType)
  res.setHeader('Cache-Control', 'private, max-age=300')
  res.send(file.body)
})

// POST /api/subscriptions/:id/approve
router.post('/:id/approve', requireRole('ADMIN'), async (req, res) => {
  try {
    const payment = await approveSubscriptionPayment(req.params.id, req.user!.adminId!)
    res.json({ ok: true, payment })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// POST /api/subscriptions/:id/reject
router.post('/:id/reject', requireRole('ADMIN'), async (req, res) => {
  const schema = z.object({ reason: z.string().optional() })
  const parse = schema.safeParse(req.body || {})
  try {
    const payment = await rejectSubscriptionPayment(
      req.params.id,
      req.user!.adminId!,
      parse.success ? parse.data.reason : undefined
    )
    res.json({ ok: true, payment })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

export default router
