/**
 * Wipe application data (keeps schema/migrations).
 *
 * Usage:
 *   cd backend && npx tsx scripts/resetDatabase.ts
 *   cd backend && npx tsx scripts/resetDatabase.ts --keep-admin   # keep Admin rows only
 *   cd backend && npx tsx scripts/resetDatabase.ts --seed
 *
 * Production:
 *   DATABASE_URL=... npx tsx scripts/resetDatabase.ts --keep-admin
 */
import '../src/lib/env'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()
const withSeed = process.argv.includes('--seed')
const keepAdmin = process.argv.includes('--keep-admin')

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('railway')) {
    console.warn('⚠️  Resetting remote/production-looking database')
  }

  if (keepAdmin) {
    const admins = await prisma.admin.findMany({ select: { id: true, name: true, username: true } })
    console.log(`🗑️  Clearing data, keeping ${admins.length} admin(s):`, admins.map((a) => a.username || a.name).join(', ') || '(none)')

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "CommunityComment",
        "CommunityPost",
        "ChatMessage",
        "MaintenanceMessage",
        "Maintenance",
        "MeterReading",
        "Payment",
        "SubscriptionPayment",
        "InvoiceItem",
        "Invoice",
        "MoveOut",
        "Contract",
        "Tenant",
        "RecurringFee",
        "Unit",
        "DocumentTemplate",
        "Property",
        "Owner"
      RESTART IDENTITY CASCADE
    `)
    console.log('✅ Cleared — Admin (+ NotifSettings) kept')
  } else {
    console.log('🗑️  Truncating all tables including Admin...')
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "CommunityComment",
        "CommunityPost",
        "ChatMessage",
        "MaintenanceMessage",
        "Maintenance",
        "MeterReading",
        "Payment",
        "SubscriptionPayment",
        "InvoiceItem",
        "Invoice",
        "MoveOut",
        "Contract",
        "Tenant",
        "RecurringFee",
        "Unit",
        "DocumentTemplate",
        "Property",
        "Owner",
        "NotifSettings",
        "Admin"
      RESTART IDENTITY CASCADE
    `)
    console.log('✅ All data cleared')
  }

  if (withSeed) {
    console.log('🌱 Running seed...')
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: process.cwd() })
  } else if (keepAdmin) {
    console.log('💡 Ready for fresh test — create owners/properties from admin LIFF.')
  } else {
    console.log('💡 Tip: use --keep-admin to preserve admin accounts, or --seed for mock data.')
  }
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', (e as Error).message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
