import { prisma } from '../src/lib/prisma'
import { signToken } from '../src/middleware/auth'

const BASE = process.env.API_BASE || 'https://lineassetmanagement-production.up.railway.app/api'

async function test(role: 'ADMIN' | 'OWNER' | 'TENANT', userId: string, extra: Record<string, string>) {
  const payment = await prisma.payment.findFirst({ where: { status: 'APPROVED' }, include: { invoice: { include: { unit: { include: { property: true } } } }, tenant: true } })
  if (!payment) throw new Error('No approved payment')
  const token = signToken({ lineUserId: userId, role, ...extra })
  const url = `${BASE}/payments/${payment.id}/receipt/pdf`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = res.ok ? `OK ${(await res.arrayBuffer()).byteLength} bytes` : await res.text()
  console.log(role, res.status, text)
  console.log('  jwt extra', extra)
  console.log('  property ownerId', payment.invoice.unit.property.ownerId, 'adminId', payment.invoice.unit.property.adminId)
  console.log('  payment tenantId', payment.tenantId, 'tenant active', payment.tenant.isActive)
}

async function main() {
  const admin = await prisma.admin.findFirst()
  const owner = await prisma.owner.findFirst({ where: { linkedAt: { not: null } } })
  const tenant = await prisma.tenant.findFirst({ where: { lineUserId: { startsWith: 'Ue22' } } })
  if (admin) await test('ADMIN', admin.lineUserId, { adminId: admin.id })
  if (owner) await test('OWNER', owner.lineUserId!, { ownerId: owner.id })
  if (tenant) await test('TENANT', tenant.lineUserId!, { unitId: tenant.unitId, tenantId: tenant.id })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
