/**
 * Send test LINE notifications to tenants (invoice / reminder / overdue).
 *
 * Usage:
 *   npx tsx scripts/testTenantNotify.ts list
 *   npx tsx scripts/testTenantNotify.ts invoice <invoiceId>
 *   npx tsx scripts/testTenantNotify.ts reminder <invoiceId> [daysLeft=3]
 *   npx tsx scripts/testTenantNotify.ts overdue <invoiceId> [daysOverdue=1]
 */
import { prisma } from '../src/lib/prisma'
import { env } from '../src/lib/env'
import { sendInvoiceLine } from '../src/services/invoiceService'
import { pushRentReminder, pushOverdue } from '../src/lib/line/lineService'
import { linkedTenant } from '../src/services/tenantLifecycle'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

async function list() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    include: { unit: { include: { property: true } } },
    orderBy: { linkedAt: 'desc' },
  })
  console.log('\n=== Tenants ===')
  for (const t of tenants) {
    console.log(`- ${t.name} | ห้อง ${t.unit.roomNumber} @ ${t.unit.property.name} | LINE: ${t.lineUserId || '(ยังไม่ผูก)'}`)
  }
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ['PENDING', 'OVERDUE'] } },
    include: { unit: { include: { tenants: { where: { isActive: true } }, property: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  console.log('\n=== Pending/Overdue Invoices ===')
  for (const inv of invoices) {
    const t = linkedTenant(inv.unit.tenants)
    console.log(
      `- ${inv.id} | ${inv.type} | ${inv.status} | ฿${inv.total} | due ${inv.dueDate.toISOString().slice(0, 10)} | ${t?.name || '-'} | LINE: ${t?.lineUserId ? 'yes' : 'no'}`
    )
  }
}

async function loadInvoice(invoiceId: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  if (!inv) throw new Error(`Invoice not found: ${invoiceId}`)
  const t = linkedTenant(inv.unit.tenants)
  if (!t?.lineUserId) throw new Error('Tenant has no linked LINE account')
  return { inv, t }
}

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2)
  if (!cmd || cmd === 'list') {
    await list()
    return
  }

  if (cmd === 'invoice') {
    const ok = await sendInvoiceLine(arg1)
    console.log(ok ? '✅ Sent invoice Flex Message' : '❌ Failed (no tenant LINE or invoice missing)')
    return
  }

  if (cmd === 'reminder') {
    const daysLeft = Number(arg2 || 3)
    const { inv, t } = await loadInvoice(arg1)
    await pushRentReminder(t.lineUserId!, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysLeft,
      amount: Number(inv.total),
      dueDate: inv.dueDate.toLocaleDateString('th-TH'),
      liffUrl: liff(`/payment/${inv.id}`),
    })
    console.log(`✅ Sent rent reminder (${daysLeft} days left) → ${t.name}`)
    return
  }

  if (cmd === 'overdue') {
    const daysOverdue = Number(arg2 || 1)
    const { inv, t } = await loadInvoice(arg1)
    const lateFee = daysOverdue * 30
    const original = Number(inv.total)
    await pushOverdue(t.lineUserId!, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysOverdue,
      originalAmount: original,
      lateFee,
      total: original + lateFee,
      liffUrl: liff(`/payment/${inv.id}`),
    })
    console.log(`✅ Sent overdue notice (${daysOverdue} days) → ${t.name}`)
    return
  }

  console.log('Unknown command. Use: list | invoice | reminder | overdue')
  process.exit(1)
}

main()
  .catch((e) => {
    console.error('❌', e.message || e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
