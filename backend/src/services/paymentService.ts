import { prisma } from '../lib/prisma'
import { liffEntryUrl } from '../lib/env'
import { generateReceipt } from './pdfService'
import { uploadFile } from './storageService'
import { pushSlipApproved, pushText } from '../lib/line/lineService'
import { notifyOwnersPayment } from './ownerNotify'
import { linkedTenant } from './tenantLifecycle'
import { resolveDocumentTemplate, renderTemplatePdf } from './documentTemplateService'
import { receiptValues } from './documentTemplateValues'

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
      invoice: { include: { unit: { include: { property: true, tenants: { where: { isActive: true } } } } } },
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
        total: Number(inv.total),
      })
    )
  } else {
    const items = [
      { label: 'ค่าเช่า', amount: Number(inv.rentAmount) },
      { label: 'ค่าไฟฟ้า', amount: Number(inv.electricAmount) },
      { label: 'ค่าน้ำ', amount: Number(inv.waterAmount) },
      { label: 'ค่าส่วนกลาง', amount: Number(inv.commonFee) },
    ]
    if (Number(inv.lateFee) > 0) items.push({ label: 'ค่าปรับล่าช้า', amount: Number(inv.lateFee) })

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

export async function approvePayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { unit: { include: { property: true, tenants: { where: { isActive: true } } } } } },
      tenant: true,
    },
  })
  if (!payment) throw new Error('Payment not found')
  if (payment.status === 'APPROVED') return

  const year = new Date().getFullYear()
  const receiptNo = await nextReceiptNo(year)

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'APPROVED', approvedAt: new Date(), receiptNo },
  })
  await prisma.invoice.update({ where: { id: payment.invoice.id }, data: { status: 'PAID' } })

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
      historyUrl: liff('/receipt'),
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

export async function rejectPayment(paymentId: string, reason: string): Promise<void> {
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
  if (notifyLine) {
    await pushText(
      notifyLine,
      `สลิปของห้อง ${payment.invoice.unit.roomNumber} ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}\nกรุณาอัปโหลดสลิปใหม่: ${liff('/payment')}`
    )
  }
}
