import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { generateReceipt } from './pdfService'
import { uploadFile } from './storageService'
import { pushSlipApproved, pushText } from '../lib/line/lineService'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

async function nextReceiptNo(year: number): Promise<string> {
  const count = await prisma.payment.count({ where: { receiptNo: { startsWith: `RCP-${year}-` } } })
  return `RCP-${year}-${String(count + 1).padStart(5, '0')}`
}

export async function approvePayment(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { unit: { include: { property: true } } } },
      tenant: true,
    },
  })
  if (!payment) throw new Error('Payment not found')
  if (payment.status === 'APPROVED') return

  const year = new Date().getFullYear()
  const receiptNo = await nextReceiptNo(year)

  const inv = payment.invoice
  const items = [
    { label: 'ค่าเช่า', amount: Number(inv.rentAmount) },
    { label: 'ค่าไฟฟ้า', amount: Number(inv.electricAmount) },
    { label: 'ค่าน้ำ', amount: Number(inv.waterAmount) },
    { label: 'ค่าส่วนกลาง', amount: Number(inv.commonFee) },
  ]
  if (Number(inv.lateFee) > 0) items.push({ label: 'ค่าปรับล่าช้า', amount: Number(inv.lateFee) })

  const pdf = await generateReceipt({
    receiptNo,
    date: new Date(),
    propertyName: inv.unit.property.name,
    propertyAddress: inv.unit.property.address,
    tenantName: payment.tenant.name,
    roomNumber: inv.unit.roomNumber,
    items,
    total: Number(inv.total),
  })

  const receiptUrl = await uploadFile(`receipts/${paymentId}.pdf`, pdf, 'application/pdf')

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'APPROVED', approvedAt: new Date(), receiptNo, receiptUrl, receiptPdfUrl: receiptUrl },
  })
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PAID' } })

  if (payment.tenant.lineUserId) {
    await pushSlipApproved(payment.tenant.lineUserId, {
      paymentId,
      receiptNo,
      roomNumber: inv.unit.roomNumber,
      tenantName: payment.tenant.name,
      amount: Number(inv.total),
      date: new Date().toLocaleDateString('th-TH'),
      receiptUrl,
    })
  }
}

export async function rejectPayment(paymentId: string, reason: string): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: { include: { unit: true } }, tenant: true },
  })
  if (!payment) throw new Error('Payment not found')

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'REJECTED', rejectedAt: new Date(), rejectReason: reason },
  })
  await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PENDING' } })

  if (payment.tenant.lineUserId) {
    await pushText(
      payment.tenant.lineUserId,
      `สลิปของห้อง ${payment.invoice.unit.roomNumber} ไม่ผ่านการตรวจสอบ\nเหตุผล: ${reason}\nกรุณาอัปโหลดสลิปใหม่: ${liff('/payment')}`
    )
  }
}
