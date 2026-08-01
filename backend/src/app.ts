import './lib/env'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { env } from './lib/env'
import { prisma } from './lib/prisma'
import { startScheduler } from './services/scheduler'
import { UPLOAD_DIR } from './services/storageService'

import authRouter from './routes/auth'
import adminRouter from './routes/admin'
import propertiesRouter from './routes/properties'
import unitsRouter from './routes/units'
import ownersRouter from './routes/owners'
import tenantsRouter from './routes/tenants'
import contractsRouter from './routes/contracts'
import metersRouter from './routes/meters'
import invoicesRouter from './routes/invoices'
import paymentsRouter from './routes/payments'
import maintenanceRouter from './routes/maintenance'
import notificationsRouter from './routes/notifications'
import reportsRouter from './routes/reports'
import webhookRouter from './routes/webhook'
import inviteRouter from './routes/invite'
import publicFilesRouter from './routes/publicFiles'
import filesRouter from './routes/files'
import subscriptionsRouter from './routes/subscriptions'
import documentTemplatesRouter from './routes/documentTemplates'

const app = express()

app.use(cors())

// Static uploads (local-disk storage fallback)
app.use('/uploads', express.static(UPLOAD_DIR))

// Webhook must be mounted BEFORE express.json() so LINE can verify the raw body
app.use('/api/webhook', webhookRouter)

app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV }))

app.use('/api/auth', authRouter)
app.use('/api/invite', inviteRouter)
app.use('/api/admin', adminRouter)
app.use('/api/properties', propertiesRouter)
app.use('/api', unitsRouter) // /properties/:id/units, /units/:id...
app.use('/api', ownersRouter) // /properties/:id/owners, /owners/:id, /owner/*
app.use('/api/tenants', tenantsRouter)
app.use('/api/contracts', contractsRouter)
app.use('/api/meters', metersRouter)
app.use('/api/invoices', invoicesRouter)
app.use('/api/public', publicFilesRouter)
app.use('/api/files', filesRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/subscriptions', subscriptionsRouter)
app.use('/api/document-templates', documentTemplatesRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reports', reportsRouter)

// Serve built frontend (single-service deploy on Railway)
const FRONTEND_DIST = path.resolve(process.cwd(), 'public')
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
  })
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

async function main() {
  try {
    await prisma.$connect()
    console.log('🗄️  Database connected')
  } catch (e) {
    console.error('⚠️  Database connection failed:', (e as Error).message)
  }
  startScheduler()
  app.listen(env.PORT, () => {
    console.log(`🚀 PropFlow backend running on port ${env.PORT} [${env.NODE_ENV}]`)
  })
}

main()

export default app
