/**
 * Deactivate duplicate active tenants on the same unit.
 * Keeps: tenant with LINE linked, else newest by createdAt.
 *
 *   npx tsx scripts/cleanupDuplicateTenants.ts
 *   npx tsx scripts/cleanupDuplicateTenants.ts --apply
 */
import { prisma } from '../src/lib/prisma'

async function main() {
  const apply = process.argv.includes('--apply')
  const units = await prisma.unit.findMany({
    include: { tenants: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } },
  })

  let fixed = 0
  for (const unit of units) {
    if (unit.tenants.length <= 1) continue
    const keep =
      unit.tenants.find((t) => t.lineUserId) || unit.tenants[unit.tenants.length - 1]
    const remove = unit.tenants.filter((t) => t.id !== keep.id)

    console.log(`\nห้อง ${unit.roomNumber}: เก็บ "${keep.name}" | ปิด ${remove.map((t) => t.name).join(', ')}`)
    if (apply) {
      await prisma.tenant.updateMany({
        where: { id: { in: remove.map((t) => t.id) } },
        data: { isActive: false, endDate: new Date() },
      })
      fixed += remove.length
    }
  }

  if (!apply) {
    console.log('\n(dry run — ใส่ --apply เพื่อบันทึกจริง)')
  } else {
    console.log(`\n✅ ปิดผู้เช่าซ้ำ ${fixed} รายการ`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
