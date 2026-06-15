/**
 * Wipe all application data (keeps schema/migrations).
 *
 * Usage:
 *   cd backend && npx tsx scripts/resetDatabase.ts
 *   cd backend && npx tsx scripts/resetDatabase.ts --seed   # reset + run seed
 *
 * Production (Railway):
 *   DATABASE_URL=... npx tsx scripts/resetDatabase.ts
 */
import '../src/lib/env'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()
const withSeed = process.argv.includes('--seed')

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Resetting PRODUCTION database — all tenants, invoices, contracts will be deleted.')
  }

  console.log('🗑️  Truncating all tables...')
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ChatMessage",
      "MaintenanceMessage",
      "Maintenance",
      "MeterReading",
      "Payment",
      "Invoice",
      "Contract",
      "Tenant",
      "Unit",
      "Property",
      "Owner",
      "NotifSettings",
      "Admin"
    RESTART IDENTITY CASCADE
  `)
  console.log('✅ All data cleared')

  if (withSeed) {
    console.log('🌱 Running seed...')
    execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: process.cwd() })
  } else {
    console.log('💡 Tip: run with --seed to load mock dev data, or re-register via LINE link flows.')
  }
}

main()
  .catch((e) => {
    console.error('❌ Reset failed:', (e as Error).message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
