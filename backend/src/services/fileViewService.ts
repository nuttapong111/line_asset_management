import jwt from 'jsonwebtoken'
import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { JwtPayload } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'
import { readFile, extractStorageKey } from './storageService'
import { ensureReceiptPdf } from './paymentService'
import { generateAndStoreContractPdf } from './contractPdfService'

const ALLOWED = [
  /^payments\/([^/]+)\/receipt\/pdf$/,
  /^payments\/([^/]+)\/slip$/,
  /^contracts\/([^/]+)\/pdf$/,
  /^contracts\/([^/]+)\/signed$/,
]

export function isAllowedFilePath(path: string): boolean {
  const clean = path.replace(/^\//, '')
  return ALLOWED.some((re) => re.test(clean))
}

async function visiblePayment(user: JwtPayload, paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { unit: { include: { property: true } } } }, tenant: true },
  })
  if (!payment) return null
  if (user.role === 'TENANT') {
    if (user.tenantId === payment.tenantId) return payment
    if (user.unitId && user.unitId === payment.invoice.unitId) return payment
    return null
  }
  if (user.role === 'ADMIN' || user.role === 'OWNER') {
    const scoped = await prisma.payment.findFirst({
      where: { id: paymentId, invoice: { unit: { property: propertyWhere(user) } } },
    })
    return scoped ? payment : null
  }
  return null
}

async function loadContract(contractId: string, user: JwtPayload) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      tenant: true,
      unit: { include: { property: { include: { admin: true } } } },
    },
  })
  if (!contract) return null
  if (user.role === 'ADMIN' && contract.unit.property.adminId !== user.adminId) return null
  if (user.role === 'OWNER' && contract.unit.property.ownerId !== user.ownerId) return null
  if (user.role === 'TENANT' && contract.unitId !== user.unitId) return null
  return contract
}

export async function assertFileAccess(user: JwtPayload, apiPath: string): Promise<void> {
  const clean = apiPath.replace(/^\//, '')
  if (!isAllowedFilePath(clean)) throw new Error('Path not allowed')

  const receipt = clean.match(/^payments\/([^/]+)\/receipt\/pdf$/)
  if (receipt) {
    const p = await visiblePayment(user, receipt[1])
    if (!p || p.status !== 'APPROVED') throw new Error('Receipt not found')
    return
  }

  const slip = clean.match(/^payments\/([^/]+)\/slip$/)
  if (slip) {
    const p = await visiblePayment(user, slip[1])
    if (!p?.slipUrl) throw new Error('Slip not found')
    return
  }

  const pdf = clean.match(/^contracts\/([^/]+)\/pdf$/)
  if (pdf) {
    if (!(await loadContract(pdf[1], user))) throw new Error('Contract not found')
    return
  }

  const signed = clean.match(/^contracts\/([^/]+)\/signed$/)
  if (signed) {
    const c = await loadContract(signed[1], user)
    if (!c?.signedDocumentUrl) throw new Error('Signed document not found')
    return
  }
}

export function issueFileViewUrl(apiPath: string, opts?: { download?: boolean }): string {
  const clean = apiPath.replace(/^\//, '')
  const token = jwt.sign({ path: clean, purpose: 'file_view' }, env.JWT_SECRET, { expiresIn: '15m' })
  const base = env.BACKEND_URL.replace(/\/$/, '')
  const q = new URLSearchParams({ token })
  if (opts?.download) q.set('dl', '1')
  return `${base}/api/public/file?${q.toString()}`
}

export async function issueFileViewUrls(user: JwtPayload, apiPath: string) {
  await assertFileAccess(user, apiPath)
  return {
    url: issueFileViewUrl(apiPath, { download: false }),
    downloadUrl: issueFileViewUrl(apiPath, { download: true }),
  }
}

export async function streamPublicFile(token: string, res: Response, download: boolean): Promise<void> {
  let path: string
  try {
    const dec = jwt.verify(token, env.JWT_SECRET) as { path?: string; purpose?: string }
    if (dec.purpose !== 'file_view' || !dec.path) throw new Error('bad token')
    path = dec.path
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  if (!isAllowedFilePath(path)) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  try {
    const receipt = path.match(/^payments\/([^/]+)\/receipt\/pdf$/)
    if (receipt) {
      const payment = await prisma.payment.findUnique({ where: { id: receipt[1] } })
      if (!payment || payment.status !== 'APPROVED') {
        res.status(404).json({ error: 'Receipt not found' })
        return
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
      const name = `receipt-${payment.receiptNo || payment.id}.pdf`
      sendFile(res, file.body, file.contentType, name, download)
      return
    }

    const slip = path.match(/^payments\/([^/]+)\/slip$/)
    if (slip) {
      const payment = await prisma.payment.findUnique({ where: { id: slip[1] } })
      if (!payment?.slipUrl) {
        res.status(404).json({ error: 'Slip not found' })
        return
      }
      const file = await readFile(extractStorageKey(payment.slipUrl))
      sendFile(res, file.body, file.contentType, `slip-${payment.id}.jpg`, download)
      return
    }

    const pdf = path.match(/^contracts\/([^/]+)\/pdf$/)
    if (pdf) {
      const contract = await prisma.contract.findUnique({
        where: { id: pdf[1] },
        include: {
          tenant: true,
          unit: { include: { property: { include: { admin: true, owner: true } } } },
        },
      })
      if (!contract) {
        res.status(404).json({ error: 'Contract not found' })
        return
      }
      let key = contract.pdfUrl ? extractStorageKey(contract.pdfUrl) : `contracts/${contract.id}.pdf`
      let file: { body: Buffer; contentType: string }
      try {
        file = await readFile(key)
      } catch {
        const built = await generateAndStoreContractPdf(contract)
        file = { body: built.pdf, contentType: 'application/pdf' }
      }
      sendFile(res, file.body, file.contentType, `contract-${contract.id}.pdf`, download)
      return
    }

    const signed = path.match(/^contracts\/([^/]+)\/signed$/)
    if (signed) {
      const contract = await prisma.contract.findUnique({ where: { id: signed[1] } })
      if (!contract?.signedDocumentUrl) {
        res.status(404).json({ error: 'No signed document' })
        return
      }
      const file = await readFile(extractStorageKey(contract.signedDocumentUrl))
      sendFile(res, file.body, file.contentType, `contract-${contract.id}-signed`, download)
      return
    }

    res.status(404).json({ error: 'Not found' })
  } catch (e) {
    console.error('[public] file stream failed', (e as Error).message)
    res.status(500).json({ error: 'Cannot load file' })
  }
}

function sendFile(res: Response, body: Buffer, contentType: string, filename: string, download: boolean) {
  res.setHeader('Content-Type', contentType)
  const mode = download ? 'attachment' : 'inline'
  const ext = contentType.includes('pdf') ? '.pdf' : contentType.includes('png') ? '.png' : '.jpg'
  const safe = filename.endsWith(ext) ? filename : `${filename}${ext}`
  res.setHeader('Content-Disposition', `${mode}; filename="${safe}"`)
  res.send(body)
}
