import { prisma } from '../lib/prisma'
import { env, liffEntryUrl } from '../lib/env'
import { uploadFile } from './storageService'
import { ocrSlip } from './ocrService'
import { pushSlipReceived } from '../lib/line/lineService'
import { notifyOwnersPayment } from './ownerNotify'
import { approvePayment, rejectPayment, recordShortfall } from './paymentService'
import { generatePromptPayPayload } from './qrService'

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

const UNPAID = ['PENDING', 'OVERDUE'] as const

export async function createPaymentBundle(tenantId: string, unitId: string, invoiceIds: string[]) {
  const unique = [...new Set(invoiceIds)]
  if (unique.length < 1) throw new Error('เลือกบิลอย่างน้อย 1 รายการ')

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: unique }, unitId, status: { in: [...UNPAID] } },
    include: { unit: { include: { property: true } }, payment: true },
  })
  if (invoices.length !== unique.length) throw new Error('มีบิลที่ไม่สามารถนำมาจ่ายรวมได้')

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, unitId, isActive: true } })
  if (!tenant) throw new Error('ไม่พบผู้เช่า')

  const total = invoices.reduce((s, i) => s + Number(i.total), 0)
  const bundle = await prisma.paymentBundle.create({
    data: { tenantId: tenant.id, total, status: 'WAITING_SLIP' },
  })

  for (const inv of invoices) {
    if (inv.payment && inv.payment.status === 'APPROVED') {
      throw new Error('บิลนี้ชำระแล้ว')
    }
    if (inv.payment) {
      await prisma.payment.update({
        where: { id: inv.payment.id },
        data: { bundleId: bundle.id, status: 'WAITING_SLIP', tenantId: tenant.id },
      })
    } else {
      await prisma.payment.create({
        data: {
          invoiceId: inv.id,
          tenantId: tenant.id,
          bundleId: bundle.id,
          status: 'WAITING_SLIP',
        },
      })
    }
  }

  const property = invoices[0].unit.property
  const promptpayNumber = property.promptpayNumber || env.DEFAULT_PROMPTPAY_NUMBER
  return {
    id: bundle.id,
    total,
    promptpayNumber,
    payload: promptpayNumber ? generatePromptPayPayload(promptpayNumber, total) : null,
    hasPaymentQr: Boolean(property.paymentQrUrl),
    propertyId: property.id,
    bankName: property.bankName,
    bankAccount: property.bankAccount,
    invoices: invoices.map((i) => ({
      id: i.id,
      type: i.type,
      month: i.month,
      year: i.year,
      total: Number(i.total),
      dueDate: i.dueDate,
    })),
  }
}

export async function getBundleForTenant(bundleId: string, tenantId: string) {
  const bundle = await prisma.paymentBundle.findFirst({
    where: { id: bundleId, tenantId },
    include: {
      payments: { include: { invoice: { include: { unit: { include: { property: true } } } } } },
    },
  })
  if (!bundle) return null
  const property = bundle.payments[0]?.invoice.unit.property
  const promptpayNumber = property?.promptpayNumber || env.DEFAULT_PROMPTPAY_NUMBER
  const total = Number(bundle.total)
  return {
    id: bundle.id,
    total,
    status: bundle.status,
    shortfall: Number(bundle.shortfall),
    rejectReason: bundle.rejectReason,
    promptpayNumber,
    payload: promptpayNumber ? generatePromptPayPayload(promptpayNumber, total) : null,
    hasPaymentQr: Boolean(property?.paymentQrUrl),
    bankName: property?.bankName,
    bankAccount: property?.bankAccount,
    paymentId: bundle.payments[0]?.id,
    invoices: bundle.payments.map((p) => ({
      id: p.invoice.id,
      type: p.invoice.type,
      month: p.invoice.month,
      year: p.invoice.year,
      total: Number(p.invoice.total),
      dueDate: p.invoice.dueDate,
      roomNumber: p.invoice.unit.roomNumber,
    })),
  }
}

export async function uploadBundleSlip(bundleId: string, tenantId: string, file: Express.Multer.File) {
  const bundle = await prisma.paymentBundle.findFirst({
    where: { id: bundleId, tenantId },
    include: {
      payments: {
        include: {
          invoice: {
            include: {
              unit: { include: { property: { include: { admin: true, owner: true } }, tenants: { where: { isActive: true } } } },
            },
          },
          tenant: true,
        },
      },
      tenant: true,
    },
  })
  if (!bundle) throw new Error('ไม่พบรายการชำระ')
  if (bundle.status === 'APPROVED') throw new Error('ชำระและอนุมัติแล้ว')

  const key = `slips/bundle/${bundle.id}/${Date.now()}.jpg`
  const slipUrl = await uploadFile(key, file.buffer, file.mimetype)
  const prop = bundle.payments[0]?.invoice.unit.property
  const expected = Number(bundle.total)
  const ocr = await ocrSlip(
    slipUrl,
    {
      expectedAmount: expected,
      expectedAccounts: [prop?.promptpayNumber, prop?.bankAccount, env.DEFAULT_PROMPTPAY_NUMBER].filter(
        (v): v is string => Boolean(v && String(v).trim())
      ),
    },
    file.buffer
  )
  const ocrData = {
    ocrAmount: ocr.amount ?? undefined,
    ocrDate: ocr.date ?? undefined,
    ocrMatched: ocr.amountMatched,
    ocrAccountMatched: ocr.accountMatched,
    ocrParsedAccount: ocr.parsedAccount ?? undefined,
    ocrNote: ocr.note ?? undefined,
  }

  await prisma.paymentBundle.update({
    where: { id: bundle.id },
    data: {
      slipUrl,
      slipUploadedAt: new Date(),
      status: 'UNDER_REVIEW',
      rejectReason: null,
      rejectedAt: null,
      ocrAmount: ocrData.ocrAmount,
      ocrMatched: ocrData.ocrMatched,
      ocrAccountMatched: ocrData.ocrAccountMatched,
      ocrParsedAccount: ocrData.ocrParsedAccount,
      ocrNote: ocrData.ocrNote,
    },
  })

  for (const p of bundle.payments) {
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        slipUrl,
        slipUploadedAt: new Date(),
        status: 'UNDER_REVIEW',
        rejectReason: null,
        rejectedAt: null,
        ...ocrData,
      },
    })
    await prisma.invoice.update({ where: { id: p.invoiceId }, data: { status: 'SLIP_UPLOADED' } })
  }

  const first = bundle.payments[0]
  if (first && prop) {
    const slipPayload = {
      paymentId: first.id,
      invoiceId: first.invoiceId,
      roomNumber: first.invoice.unit.roomNumber,
      tenantName: bundle.tenant.name,
      amount: expected,
      slipUrl,
      reviewUrl: liff(`/admin/slip/${first.id}`),
    }
    if (prop.admin.lineUserId) await pushSlipReceived(prop.admin.lineUserId, slipPayload)
    if (prop.owner?.lineUserId && prop.owner.lineUserId !== prop.admin.lineUserId) {
      await pushSlipReceived(prop.owner.lineUserId, slipPayload)
    }
    await notifyOwnersPayment({
      propertyId: prop.id,
      roomNumber: first.invoice.unit.roomNumber,
      tenantName: bundle.tenant.name,
      amount: expected,
      kind: 'slip',
    })
  }

  return { ok: true, paymentId: first?.id, bundleId: bundle.id }
}

export async function approveBundle(bundleId: string, opts?: { acceptShortfall?: boolean }) {
  const bundle = await prisma.paymentBundle.findUnique({
    where: { id: bundleId },
    include: { payments: { include: { invoice: true } } },
  })
  if (!bundle) throw new Error('ไม่พบรายการชำระ')
  if (bundle.status === 'APPROVED') return

  let shortfall = 0
  if (opts?.acceptShortfall && bundle.ocrAmount != null) {
    shortfall = Math.max(0, Math.round((Number(bundle.total) - Number(bundle.ocrAmount)) * 100) / 100)
  }

  for (const p of bundle.payments) {
    await approvePayment(p.id)
  }
  if (shortfall > 0 && bundle.payments[0]) {
    await recordShortfall(bundle.payments[0].invoice.unitId, shortfall)
  }
  await prisma.paymentBundle.update({
    where: { id: bundle.id },
    data: { status: 'APPROVED', approvedAt: new Date(), shortfall },
  })
}

export async function rejectBundle(bundleId: string, reason: string) {
  const bundle = await prisma.paymentBundle.findUnique({
    where: { id: bundleId },
    include: { payments: true },
  })
  if (!bundle) throw new Error('ไม่พบรายการชำระ')
  for (const p of bundle.payments) {
    if (p.status !== 'REJECTED') await rejectPayment(p.id, reason, { silent: true })
  }
  const first = bundle.payments[0]
  if (first) {
    const payment = await prisma.payment.findUnique({
      where: { id: first.id },
      include: { invoice: { include: { unit: true } }, tenant: true },
    })
    if (payment?.tenant.lineUserId) {
      const { pushText } = await import('../lib/line/lineService')
      await pushText(
        payment.tenant.lineUserId,
        `สลิปรวมของห้อง ${payment.invoice.unit.roomNumber} ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}\nกรุณาอัปโหลดสลิปใหม่: ${liff('/pay')}`
      )
    }
  }
  await prisma.paymentBundle.update({
    where: { id: bundle.id },
    data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: reason },
  })
}
