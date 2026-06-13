import { prisma } from '../lib/prisma'
import { removeTenantRichMenu } from '../lib/line/richMenu'

/** End tenancy: terminate contract, deactivate tenant, mark unit vacant. */
export async function moveOutByContractId(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { tenant: true, unit: true },
  })
  if (!contract) throw new Error('Contract not found')
  if (contract.status === 'TERMINATED') throw new Error('Contract already terminated')

  if (contract.tenant.lineUserId) {
    await removeTenantRichMenu(contract.tenant.lineUserId)
  }

  const now = new Date()
  await prisma.$transaction([
    prisma.contract.update({ where: { id: contract.id }, data: { status: 'TERMINATED' } }),
    prisma.tenant.update({
      where: { id: contract.tenantId },
      data: { isActive: false, endDate: now },
    }),
    prisma.unit.update({ where: { id: contract.unitId }, data: { status: 'VACANT' } }),
  ])

  return contract
}

/** One active tenant per unit — prefer linked LINE account for display/notifications. */
export function linkedTenant<T extends { lineUserId: string | null }>(tenants: T[]): T | undefined {
  return tenants.find((t) => t.lineUserId) ?? tenants[0]
}
