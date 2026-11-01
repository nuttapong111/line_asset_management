import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Railway entrypoint.
 * Brings PostgreSQL in line with prisma/migrations before the API listens.
 *
 * Cases:
 * 1. Empty database — migrate deploy applies every migration.
 * 2. Database already on an older migration — deploy applies only the pending ones.
 * 3. A previous deploy left a failed migration row — clear that row and retry.
 * 4. Tables already exist (db push, or a statement like "already exists") — sync from
 *    schema.prisma without dropping data, then mark the local migrations as applied.
 */
const root = path.resolve(__dirname, '..')
const prismaBin = path.join(root, 'node_modules', '.bin', 'prisma')

function run(args: string): { ok: boolean; output: string } {
  try {
    const output = execSync(`"${prismaBin}" ${args}`, {
      cwd: root,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (output) process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)
    return { ok: true, output: output || '' }
  } catch (err) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string }
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).map(String).join('\n')
    if (output) process.stdout.write(output.endsWith('\n') ? output : `${output}\n`)
    return { ok: false, output }
  }
}

function migrationNames(): string[] {
  const dir = path.join(root, 'prisma', 'migrations')
  return fs
    .readdirSync(dir)
    .filter((name) => fs.existsSync(path.join(dir, name, 'migration.sql')))
    .sort()
}

function failedMigrationName(output: string): string | undefined {
  return (
    output.match(/The `([^`]+)` migration started/)?.[1] ||
    output.match(/Migration name: (\S+)/)?.[1]
  )
}

function alreadyThere(output: string): boolean {
  return /already exists|already recorded|P3005|P3008|42710|42701|42P07|duplicate key|duplicate_object/i.test(
    output
  )
}

function markApplied(name: string) {
  const marked = run(`migrate resolve --applied "${name}"`)
  if (marked.ok || alreadyThere(marked.output)) return
  console.error(`Could not record migration ${name}`)
  process.exit(1)
}

function syncFromSchema() {
  console.log('Syncing schema from schema.prisma without dropping data...')
  const pushed = run('db push --skip-generate')
  if (!pushed.ok) {
    console.error('Could not sync the database schema.')
    process.exit(1)
  }
  for (const name of migrationNames()) markApplied(name)
  const finalDeploy = run('migrate deploy')
  if (!finalDeploy.ok) {
    console.error('Database schema was synced, but migration history is still inconsistent.')
    process.exit(1)
  }
}

function ensureDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Link the Railway PostgreSQL plugin before deploy.')
    process.exit(1)
  }
  if (!fs.existsSync(prismaBin)) {
    console.error('Prisma CLI 5.22 was not found in the image at', prismaBin)
    process.exit(1)
  }

  console.log('Applying migrations...')
  let result = run('migrate deploy')
  if (result.ok) {
    console.log('Migrations applied')
    return
  }

  const failed = failedMigrationName(result.output)
  if ((result.output.includes('P3009') || result.output.includes('P3018')) && failed) {
    console.log('Retrying after a failed migration record:', failed)
    run(`migrate resolve --rolled-back "${failed}"`)
    result = run('migrate deploy')
    if (result.ok) {
      console.log('Migrations applied')
      return
    }
  }

  if (alreadyThere(result.output) || result.output.includes('P3005') || result.output.includes('P3018')) {
    syncFromSchema()
    console.log('Database schema is complete')
    return
  }

  console.error('prisma migrate deploy failed and the error is not a schema-history mismatch.')
  process.exit(1)
}

ensureDatabase()

import('./app')
  .then((mod) => mod.main())
  .catch((err) => {
    console.error('Failed to start API', err)
    process.exit(1)
  })
