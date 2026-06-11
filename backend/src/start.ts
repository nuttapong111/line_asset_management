import { execSync } from 'child_process'

/**
 * Production entrypoint for Railway.
 * Runs `prisma migrate deploy` first; if it fails (e.g. DB not yet reachable),
 * we log the error but still boot the HTTP server so the platform healthcheck
 * can pass and the real error is visible in Deploy Logs.
 */
function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('⚠️  DATABASE_URL is not set — skipping migrations. Add a PostgreSQL plugin and set DATABASE_URL.')
    return
  }
  try {
    console.log('▶️  Running prisma migrate deploy...')
    execSync('npx prisma migrate deploy', { stdio: 'inherit' })
    console.log('✅ Migrations applied')
  } catch (err) {
    console.error('⚠️  prisma migrate deploy failed (continuing to start server):', (err as Error).message)
  }
}

runMigrations()

// Importing app.ts starts the Express server (it calls main() on import)
import('./app')
