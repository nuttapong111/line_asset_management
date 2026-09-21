import { prisma } from '../lib/prisma'
import { removeTenantRichMenu } from '../lib/line/richMenu'

export type Deduction = { label: string; amount: number }

export interface MoveOutInput {
  deductions?: Deduction[]
  notes?: string
  finalElec?: number
  finalWater?: number
}

export async function moveOutPreview(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      tenant: true,
      unit: { include: { meterReadings: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      moveOut: true,
    },
  })
  if (!contract) throw new Error('Contract not found')
  if (contract.status === 'TERMINATED') throw new Error('Contract already terminated')

  const unpaid = await prisma.invoice.findMany({
    where: {
      unitId: contract.unitId,
      status: { in: ['PENDING', 'SLIP_UPLOADED', 'OVERDUE'] },
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })
  const unpaidTotal = unpaid.reduce((a, i) => a + Number(i.total), 0)
  const deposit = Number(contract.deposit)
  const lastMeter = contract.unit.meterReadings[0] ?? null

  return {
    contract,
    deposit,
    unpaidInvoices: unpaid.map((i) => ({
      id: i.id,
      type: i.type,
      month: i.month,
      year: i.year,
      total: Number(i.total),
      status: i.status,
    })),
    unpaidTotal,
    lastMeter: lastMeter
      ? {
          month: lastMeter.month,
          year: lastMeter.year,
          currElec: Number(lastMeter.currElec),
          currWater: Number(lastMeter.currWater),
        }
      : null,
    suggestedRefund: deposit - unpaidTotal,
  }
}

/** End tenancy: settle deposit, terminate contract, deactivate tenant, mark unit vacant. */
export async function moveOutByContractId(contractId: string, input: MoveOutInput = {}) {
  const preview = await moveOutPreview(contractId)
  const deductions = (input.deductions ?? []).filter((d) => d.label.trim() && d.amount > 0)
  const deductionTotal = deductions.reduce((a, d) => a + d.amount, 0)
  const refundAmount = preview.deposit - preview.unpaidTotal - deductionTotal

  if (preview.contract.tenant.lineUserId) {
    await removeTenantRichMenu(preview.contract.tenant.lineUserId)
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.moveOut.create({
      data: {
        contractId,
        deposit: preview.deposit,
        unpaidTotal: preview.unpaidTotal,
        deductions,
        refundAmount,
        notes: input.notes,
        finalElec: input.finalElec,
        finalWater: input.finalWater,
      },
    }),
    prisma.contract.update({ where: { id: contractId }, data: { status: 'TERMINATED' } }),
    prisma.tenant.update({
      where: { id: preview.contract.tenantId },
      data: { isActive: false, endDate: now },
    }),
    prisma.unit.update({ where: { id: preview.contract.unitId }, data: { status: 'VACANT' } }),
  ])

  return { refundAmount, unpaidTotal: preview.unpaidTotal, deposit: preview.deposit, deductions }
}

/** One active tenant per unit — prefer linked LINE account for display/notifications. */
export function linkedTenant<T extends { lineUserId: string | null }>(tenants: T[]): T | undefined {
  return tenants.find((t) => t.lineUserId) ?? tenants[0]
}
