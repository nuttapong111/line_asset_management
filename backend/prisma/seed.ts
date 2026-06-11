import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const admin = await prisma.admin.upsert({
    where: { lineUserId: 'mock_admin_001' },
    update: {},
    create: {
      lineUserId: 'mock_admin_001',
      name: 'วิชัย ทดสอบ',
      phone: '0899999999',
      notifSettings: { create: {} },
    },
  })

  const property = await prisma.property.create({
    data: {
      adminId: admin.id,
      name: 'คอนโด สุขุมวิท 31',
      address: '31 ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110',
      bankName: 'ธนาคารกสิกรไทย',
      bankAccount: '123-4-56789-0',
      promptpayNumber: '0812345678',
    },
  })

  const unitsData = [
    { roomNumber: '101', floor: 1, rentPrice: 4500 },
    { roomNumber: '102', floor: 1, rentPrice: 3500 },
    { roomNumber: '103', floor: 1, rentPrice: 5000 },
  ]

  const units = []
  for (const u of unitsData) {
    const unit = await prisma.unit.create({
      data: {
        propertyId: property.id,
        roomNumber: u.roomNumber,
        floor: u.floor,
        rentPrice: u.rentPrice,
        electricRate: 5,
        waterRate: 18,
        commonFee: 50,
      },
    })
    units.push(unit)
  }

  // Tenant linked to room 101
  const room101 = units[0]
  const tenant = await prisma.tenant.create({
    data: {
      lineUserId: 'mock_tenant_001',
      name: 'สมชาย ทดสอบ',
      phone: '0811111111',
      lineId: '@somchai',
      idCardNumber: '1100000000001',
      unitId: room101.id,
      startDate: new Date('2025-01-01'),
      isActive: true,
      linkedAt: new Date(),
    },
  })

  await prisma.unit.update({
    where: { id: room101.id },
    data: { status: 'OCCUPIED' },
  })

  await prisma.contract.create({
    data: {
      tenantId: tenant.id,
      unitId: room101.id,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2026-12-31'),
      rentAmount: 4500,
      deposit: 9000,
      lateFeePerDay: 30,
      dueDay: 5,
      status: 'ACTIVE',
    },
  })

  await prisma.meterReading.create({
    data: {
      unitId: room101.id,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      prevElec: 5170,
      currElec: 5352,
      prevWater: 120,
      currWater: 126,
    },
  })

  console.log('✅ Seed complete')
  console.log({ admin: admin.name, property: property.name, units: units.length, tenant: tenant.name })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
