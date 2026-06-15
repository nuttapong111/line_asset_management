/**
 * Verify R2 upload + read roundtrip.
 * Usage: cd backend && npx tsx scripts/testR2.ts
 * Railway: railway run npx tsx scripts/testR2.ts
 */
import '../src/lib/env'
import { isR2Configured, env } from '../src/lib/env'
import { uploadFile, readFile } from '../src/services/storageService'

async function main() {
  if (!isR2Configured) {
    console.error('❌ R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET')
    process.exit(1)
  }
  console.log('🔍 R2 bucket:', env.R2_BUCKET, '| account:', env.R2_ACCOUNT_ID.slice(0, 8) + '...')

  const key = `healthcheck/r2-${Date.now()}.txt`
  const payload = `PropFlow R2 OK ${new Date().toISOString()}`
  const stored = await uploadFile(key, Buffer.from(payload, 'utf8'), 'text/plain')
  console.log('📤 uploaded:', stored)

  const { body, contentType } = await readFile(key)
  const text = body.toString('utf8')
  if (text !== payload) throw new Error(`roundtrip mismatch: got "${text}"`)

  console.log('📥 read OK | type:', contentType)
  console.log('✅ R2 working')
}

main().catch((e) => {
  console.error('❌ R2 test failed:', (e as Error).message)
  process.exit(1)
})
