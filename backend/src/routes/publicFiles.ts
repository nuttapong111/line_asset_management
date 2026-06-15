import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { readFile, extractStorageKey } from '../services/storageService'
import { ensureReceiptPdf } from '../services/paymentService'
import { streamPublicFile } from '../services/fileViewService'

const router = Router()

/** Generic file stream — token from POST /api/files/view-token */
router.get('/file', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined
  if (!token) return res.status(401).json({ error: 'Missing token' })
  await streamPublicFile(token, res, req.query.dl === '1')
})

/** Public receipt PDF stream — requires short-lived token from POST /payments/:id/receipt/view-token */
router.get('/receipt/:paymentId', async (req: Request, res: Response) => {
  const token = req.query.token as string | undefined
  if (!token) return res.status(401).json({ error: 'Missing token' })

  let paymentId: string
  try {
    const dec = jwt.verify(token, env.JWT_SECRET) as { paymentId?: string; purpose?: string }
    if (dec.purpose !== 'receipt_pdf' || !dec.paymentId) throw new Error('bad token')
    paymentId = dec.paymentId
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  if (req.params.paymentId !== paymentId) {
    return res.status(403).json({ error: 'Token mismatch' })
  }

  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.status !== 'APPROVED') {
      return res.status(404).json({ error: 'Receipt not found' })
    }

    let stored = payment.receiptPdfUrl || payment.receiptUrl
    if (!stored) stored = await ensureReceiptPdf(payment.id)

    let file
    try {
      file = await readFile(extractStorageKey(stored))
    } catch {
      stored = await ensureReceiptPdf(payment.id)
      file = await readFile(extractStorageKey(stored))
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="receipt-${payment.receiptNo || payment.id}.pdf"`)
    res.send(file.body)
  } catch (e) {
    console.error('[public] receipt pdf failed', (e as Error).message)
    res.status(500).json({ error: 'Cannot load receipt PDF' })
  }
})

export default router
