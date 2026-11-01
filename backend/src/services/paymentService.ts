import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { generateReceipt } from './pdfService'
import { uploadFile } from './storageService'
import { pushSlipApproved, pushText } from '../lib/line/lineService'
import { notifyOwnersPayment } from './ownerNotify'
import { linkedTenant } from './tenantLifecycle'
import { resolveDocumentTemplate, renderTemplatePdf } from './documentTemplateService'
import { receiptValues } from './documentTemplateValues'
import { invoiceLineItems } from './invoiceService'

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

export function receiptPdfLiffUrl(paymentId: string): string {
  return liff(
    `/pdf-viewer?path=${encodeURIComponent(`payments/${paymentId}/receipt/pdf`)}&title=${encodeURIComponent('ใบเสร็จรับเงิน')}`
  )
}

async function nextReceiptNo(year: number): Promise<string> {
  const count = await prisma.payment.count({ where: { receiptNo: { startsWith: `RCP-${year}-` } } })
  return `RCP-${year}-${String(count + 1).padStart(5, '0')}`
}

/** Build receipt PDF, upload to storage, persist URLs on payment. Returns storage key reference. */
export async function ensureReceiptPdf(paymentId: string): Promise<string> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { extraItems: true, unit: { include: { property: true, tenants: { where: { isActive: true } } } } } },
      tenant: true,
    },
  })
  if (!payment) throw new Error('Payment not found')

  const receiptNo =
    payment.receiptNo ||
    (await nextReceiptNo(payment.approvedAt?.getFullYear() ?? new Date().getFullYear()))

  const inv = payment.invoice
  const tenantName =
    payment.tenant.isActive
      ? payment.tenant.name
      : inv.unit.tenants.find((t) => t.lineUserId)?.name || payment.tenant.name

  const property = inv.unit.property
  const template = await resolveDocumentTemplate(property.ownerId, 'RECEIPT', property.id)

  let pdf: Buffer
  if (template) {
    pdf = await renderTemplatePdf(
      template,
      receiptValues({
        receiptNo,
        date: payment.approvedAt ?? new Date(),
        propertyName: property.name,
        propertyAddress: property.address,
        tenantName,
        roomNumber: inv.unit.roomNumber,
        rentAmount: Number(inv.rentAmount),
        electricAmount: Number(inv.electricAmount),
        waterAmount: Number(inv.waterAmount),
        commonFee: Number(inv.commonFee),
        lateFee: Number(inv.lateFee),
        extraItems: (inv.extraItems ?? []).map((i) => ({ label: i.label, amount: Number(i.amount) })),
        total: Number(inv.total),
      })
    )
  } else {
    const items = invoiceLineItems(inv).filter((i) => i.amount > 0)

    pdf = await generateReceipt({
      receiptNo,
      date: payment.approvedAt ?? new Date(),
      propertyName: property.name,
      propertyAddress: property.address,
      tenantName,
      roomNumber: inv.unit.roomNumber,
      items,
      total: Number(inv.total),
    })
  }

  const receiptUrl = await uploadFile(`receipts/${paymentId}.pdf`, pdf, 'application/pdf')
  await prisma.payment.update({
    where: { id: paymentId },
    data: { receiptNo, receiptUrl, receiptPdfUrl: receiptUrl },
  })
  return receiptUrl
}

/** บันทึกยอดที่ยังค้างหลังรับสลิปไม่ครบ เป็นบิล SHORTFALL ของเดือนนั้น */
export async function recordShortfall(unitId: string, amount: number): Promise<void> {
  const due = Math.round(amount * 100) / 100
  if (due <= 0) return
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const existing = await prisma.invoice.findUnique({
    where: { unitId_month_year_type: { unitId, month, year, type: 'SHORTFALL' } },
  })
  if (existing && existing.status !== 'PAID' && existing.status !== 'CANCELLED') {
    const total = Number(existing.total) + due
    await prisma.invoice.update({
      where: { id: existing.id },
      data: { total, extraAmount: total, status: existing.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING' },
    })
    return
  }
  if (existing) return
  await prisma.invoice.create({
    data: {
      unitId,
      type: 'SHORTFALL',
      month,
      year,
      rentAmount: 0,
      electricAmount: 0,
      waterAmount: 0,
      commonFee: 0,
      lateFee: 0,
      extraAmount: due,
      total: due,
      dueDate: now,
      status: 'PENDING',
    },
  })
}

export async function approvePayment(
  paymentId: string,
  opts?: { acceptShortfall?: boolean }
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { extraItems: true, unit: { include: { property: true, tenants: { where: { isActive: true } } } } } },
      tenant: true,
    },
  })
  if (!payment) throw new Error('Payment not found')
  if (payment.status === 'APPROVED') return

  const year = new Date().getFullYear()
  const receiptNo = await nextReceiptNo(year)

  let shortfall = 0
  if (opts?.acceptShortfall && payment.ocrAmount != null) {
    shortfall = Math.max(0, Math.round((Number(payment.invoice.total) - Number(payment.ocrAmount)) * 100) / 100)
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'APPROVED', approvedAt: new Date(), receiptNo, shortfall },
  })
  await prisma.invoice.update({ where: { id: payment.invoice.id }, data: { status: 'PAID' } })
  if (shortfall > 0) await recordShortfall(payment.invoice.unitId, shortfall)

  await ensureReceiptPdf(paymentId)

  const inv = payment.invoice
  const activeTenant = linkedTenant(inv.unit.tenants) || payment.tenant
  const notifyLine = activeTenant.lineUserId

  if (notifyLine) {
    await pushSlipApproved(notifyLine, {
      paymentId,
      receiptNo,
      roomNumber: inv.unit.roomNumber,
      tenantName: activeTenant.name,
      amount: Number(inv.total),
      date: new Date().toLocaleDateString('th-TH'),
      receiptUrl: receiptPdfLiffUrl(paymentId),
      historyUrl: liff('/documents'),
    })
  }

  await notifyOwnersPayment({
    propertyId: inv.unit.property.id,
    roomNumber: inv.unit.roomNumber,
    tenantName: payment.tenant.name,
    amount: Number(inv.total),
    kind: 'approved',
  })
}

export async function rejectPayment(
  paymentId: string,
  reason: string,
  opts?: { silent?: boolean }
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { unit: { include: { tenants: { where: { isActive: true } } } } } },
      tenant: true,
    },
  })
  if (!payment) throw new Error('Payment not found')

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: reason },
  })
  await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PENDING' } })

  const notifyLine = linkedTenant(payment.invoice.unit.tenants)?.lineUserId || payment.tenant.lineUserId
  if (notifyLine && !opts?.silent) {
    await pushText(
      notifyLine,
      `สลิปของห้อง ${payment.invoice.unit.roomNumber} ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}\nกรุณาอัปโหลดสลิปใหม่: ${liff('/payment')}`
    )
  }
}
