import { InvoiceType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { pushInvoice } from '../lib/line/lineService'
import { linkedTenant } from './tenantLifecycle'
import { InvoiceData } from '../lib/line/types/line.types'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export interface InvoiceDraft {
  unitId: string
  type: InvoiceType
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

async function activeContract(unitId: string) {
  return prisma.contract.findFirst({
    where: { unitId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
}

/** ค่าเช่ารายเดือน (ค่าเช่า + ค่าส่วนกลาง) — สร้างอัตโนมัติทุกเดือนจนกว่าสัญญาจะยกเลิก */
export async function buildRentInvoiceDraft(unitId: string, month: number, year: number): Promise<InvoiceDraft> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } })
  if (!unit) throw new Error('Unit not found')

  const contract = await activeContract(unitId)
  if (!contract) throw new Error('ไม่มีสัญญาเช่าที่ใช้งานอยู่')

  const rentAmount = Number(unit.rentPrice)
  const commonFee = Number(unit.commonFee)
  const total = rentAmount + commonFee
  const dueDay = contract.dueDay ?? 5
  const dueDate = new Date(year, month - 1, dueDay)

  return {
    unitId,
    type: 'RENT',
    month,
    year,
    rentAmount,
    electricAmount: 0,
    waterAmount: 0,
    commonFee,
    lateFee: 0,
    total,
    dueDate,
  }
}

/** บิลค่าน้ำค่าไฟ — สร้างเมื่อมีการบันทึกมิเตอร์แล้วเท่านั้น */
export async function buildUtilityInvoiceDraft(unitId: string, month: number, year: number): Promise<InvoiceDraft> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } })
  if (!unit) throw new Error('Unit not found')

  const meter = await prisma.meterReading.findFirst({
    where: { unitId, month, year },
    orderBy: { createdAt: 'desc' },
  })
  if (!meter) throw new Error('ยังไม่มีการบันทึกมิเตอร์สำหรับเดือนนี้')

  const usedElec = Math.max(0, Number(meter.currElec) - Number(meter.prevElec))
  const usedWater = Math.max(0, Number(meter.currWater) - Number(meter.prevWater))
  const electricAmount = usedElec * Number(unit.electricRate)
  const waterAmount = usedWater * Number(unit.waterRate)
  const total = electricAmount + waterAmount

  const contract = await activeContract(unitId)
  const dueDay = contract?.dueDay ?? 5
  const dueDate = new Date(year, month - 1, dueDay)

  return {
    unitId,
    type: 'UTILITY',
    month,
    year,
    rentAmount: 0,
    electricAmount,
    waterAmount,
    commonFee: 0,
    lateFee: 0,
    total,
    dueDate,
    meterReading: {
      prevElec: Number(meter.prevElec),
      currElec: Number(meter.currElec),
      prevWater: Number(meter.prevWater),
      currWater: Number(meter.currWater),
      usedElec,
      usedWater,
    },
  }
}

/** @deprecated use buildRentInvoiceDraft or buildUtilityInvoiceDraft */
export async function buildInvoiceDraft(unitId: string, month: number, year: number): Promise<InvoiceDraft> {
  const rent = await buildRentInvoiceDraft(unitId, month, year)
  try {
    const util = await buildUtilityInvoiceDraft(unitId, month, year)
    return {
      ...rent,
      electricAmount: util.electricAmount,
      waterAmount: util.waterAmount,
      total: rent.total + util.electricAmount + util.waterAmount,
      meterReading: util.meterReading,
    }
  } catch {
    return rent
  }
}

export async function createInvoiceFromDraft(draft: InvoiceDraft) {
  return prisma.invoice.create({
    data: {
      unitId: draft.unitId,
      type: draft.type,
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

function invoiceLineItems(invoice: {
  type: InvoiceType
  rentAmount: unknown
  electricAmount: unknown
  waterAmount: unknown
  commonFee: unknown
}) {
  const items: { label: string; amount: number }[] = []
  if (invoice.type === 'RENT') {
    items.push({ label: 'ค่าเช่า', amount: Number(invoice.rentAmount) })
    if (Number(invoice.commonFee) > 0) items.push({ label: 'ค่าส่วนกลาง', amount: Number(invoice.commonFee) })
  } else {
    if (Number(invoice.electricAmount) > 0) items.push({ label: 'ค่าไฟฟ้า', amount: Number(invoice.electricAmount) })
    if (Number(invoice.waterAmount) > 0) items.push({ label: 'ค่าน้ำ', amount: Number(invoice.waterAmount) })
  }
  return items
}

export async function sendInvoiceLine(invoiceId: string): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  if (!invoice) return false
  const tenant = linkedTenant(invoice.unit.tenants)
  if (!tenant?.lineUserId) return false

  const typeLabel = invoice.type === 'RENT' ? 'ใบแจ้งหนี้ค่าเช่า' : 'ใบแจ้งหนี้ค่าน้ำค่าไฟ'
  const data: InvoiceData = {
    invoiceId: invoice.id,
    roomNumber: invoice.unit.roomNumber,
    tenantName: tenant.name,
    month: invoice.month,
    year: invoice.year,
    items: invoiceLineItems(invoice),
    total: Number(invoice.total),
    dueDate: invoice.dueDate.toLocaleDateString('th-TH'),
    liffUrl: liff(`/payment/${invoice.id}`),
    title: typeLabel,
  }
  await pushInvoice(tenant.lineUserId, data)
  await prisma.invoice.update({ where: { id: invoice.id }, data: { sentAt: new Date() } })
  return true
}

async function upsertAndSend(
  unitId: string,
  month: number,
  year: number,
  type: InvoiceType,
  build: () => Promise<InvoiceDraft>
) {
  let invoice = await prisma.invoice.findFirst({ where: { unitId, month, year, type } })
  if (!invoice) {
    const draft = await build()
    invoice = await createInvoiceFromDraft(draft)
  }
  const ok = await sendInvoiceLine(invoice.id)
  return { ok, invoice }
}

/** ส่งใบแจ้งหนี้ค่าเช่าทุกห้องที่มีสัญญา active */
export async function buildAndSendRentForProperty(propertyId: string, month: number, year: number) {
  const units = await prisma.unit.findMany({
    where: {
      propertyId,
      status: 'OCCUPIED',
      contracts: { some: { status: 'ACTIVE' } },
      tenants: { some: { isActive: true } },
    },
  })
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const unit of units) {
    try {
      const { ok } = await upsertAndSend(unit.id, month, year, 'RENT', () =>
        buildRentInvoiceDraft(unit.id, month, year)
      )
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

/** ส่งบิลค่าน้ำค่าไฟ (ต้องบันทึกมิเตอร์ก่อน) */
export async function buildAndSendUtilityForProperty(propertyId: string, month: number, year: number) {
  const units = await prisma.unit.findMany({
    where: {
      propertyId,
      status: 'OCCUPIED',
      tenants: { some: { isActive: true } },
      meterReadings: { some: { month, year } },
    },
  })
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const unit of units) {
    try {
      const { ok } = await upsertAndSend(unit.id, month, year, 'UTILITY', () =>
        buildUtilityInvoiceDraft(unit.id, month, year)
      )
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

/** @deprecated — sends rent only (auto billing) */
export async function buildAndSendForProperty(propertyId: string, month: number, year: number) {
  return buildAndSendRentForProperty(propertyId, month, year)
}
