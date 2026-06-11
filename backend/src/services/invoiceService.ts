import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { pushInvoice } from '../lib/line/lineService'
import { InvoiceData } from '../lib/line/types/line.types'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export interface InvoiceDraft {
  unitId: string
  month: number
  year: number
  rentAmount: number
  electricAmount: number
  waterAmount: number
  commonFee: number
  lateFee: number
  total: number
  dueDate: Date
  meterReading?: {
    prevElec: number
    currElec: number
    prevWater: number
    currWater: number
    usedElec: number
    usedWater: number
  }
}

export async function buildInvoiceDraft(unitId: string, month: number, year: number): Promise<InvoiceDraft> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } })
  if (!unit) throw new Error('Unit not found')

  const meter = await prisma.meterReading.findFirst({
    where: { unitId, month, year },
    orderBy: { createdAt: 'desc' },
  })

  let electricAmount = 0
  let waterAmount = 0
  let meterReading: InvoiceDraft['meterReading']

  if (meter) {
    const usedElec = Number(meter.currElec) - Number(meter.prevElec)
    const usedWater = Number(meter.currWater) - Number(meter.prevWater)
    electricAmount = Math.max(0, usedElec) * Number(unit.electricRate)
    waterAmount = Math.max(0, usedWater) * Number(unit.waterRate)
    meterReading = {
      prevElec: Number(meter.prevElec),
      currElec: Number(meter.currElec),
      prevWater: Number(meter.prevWater),
      currWater: Number(meter.currWater),
      usedElec,
      usedWater,
    }
  }

  const rentAmount = Number(unit.rentPrice)
  const commonFee = Number(unit.commonFee)
  const lateFee = 0
  const total = rentAmount + electricAmount + waterAmount + commonFee + lateFee

  // dueDate: default day 5 of the month
  const contract = await prisma.contract.findFirst({
    where: { unitId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  const dueDay = contract?.dueDay ?? 5
  const dueDate = new Date(year, month - 1, dueDay)

  return {
    unitId,
    month,
    year,
    rentAmount,
    electricAmount,
    waterAmount,
    commonFee,
    lateFee,
    total,
    dueDate,
    meterReading,
  }
}

export async function createInvoiceFromDraft(draft: InvoiceDraft) {
  return prisma.invoice.create({
    data: {
      unitId: draft.unitId,
      month: draft.month,
      year: draft.year,
      rentAmount: draft.rentAmount,
      electricAmount: draft.electricAmount,
      waterAmount: draft.waterAmount,
      commonFee: draft.commonFee,
      lateFee: draft.lateFee,
      total: draft.total,
      dueDate: draft.dueDate,
      status: 'PENDING',
    },
  })
}

export async function sendInvoiceLine(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  if (!invoice) return false
  const tenant = invoice.unit.tenants[0]
  if (!tenant?.lineUserId) return false

  const data: InvoiceData = {
    invoiceId: invoice.id,
    roomNumber: invoice.unit.roomNumber,
    tenantName: tenant.name,
    month: invoice.month,
    year: invoice.year,
    items: [
      { label: 'ค่าเช่า', amount: Number(invoice.rentAmount) },
      { label: 'ค่าไฟฟ้า', amount: Number(invoice.electricAmount) },
      { label: 'ค่าน้ำ', amount: Number(invoice.waterAmount) },
      { label: 'ค่าส่วนกลาง', amount: Number(invoice.commonFee) },
    ],
    total: Number(invoice.total),
    dueDate: invoice.dueDate.toLocaleDateString('th-TH'),
    liffUrl: liff(`/payment/${invoice.id}`),
  }
  await pushInvoice(tenant.lineUserId, data)
  await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } })
  return true
}

export async function buildAndSendForProperty(propertyId: string, month: number, year: number) {
  const units = await prisma.unit.findMany({
    where: { propertyId, status: 'OCCUPIED' },
  })
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const unit of units) {
    try {
      let invoice = await prisma.invoice.findFirst({ where: { unitId: unit.id, month, year } })
      if (!invoice) {
        const draft = await buildInvoiceDraft(unit.id, month, year)
        invoice = await createInvoiceFromDraft(draft)
      }
      const ok = await sendInvoiceLine(invoice.id)
      if (ok) sent++
      else {
        failed++
        errors.push(`ห้อง ${unit.roomNumber}: ไม่มีผู้เช่าที่ผูก LINE`)
      }
    } catch (e) {
      failed++
      errors.push(`ห้อง ${unit.roomNumber}: ${(e as Error).message}`)
    }
  }
  return { sent, failed, errors }
}
