import { Router, json } from 'express'
import { WebhookEvent } from '@line/bot-sdk'
import { lineSignatureMiddleware } from '../middleware/lineSignature'
import { handleLineEvents } from '../lib/line/webhook'
import { isLineConfigured } from '../lib/env'

const router = Router()

// In real mode the LINE SDK middleware parses + verifies the raw body.
// In mock mode we parse JSON ourselves.
const bodyParser = isLineConfigured ? lineSignatureMiddleware : json()

// POST /api/webhook
router.post('/', bodyParser, async (req, res) => {
  const events: WebhookEvent[] = req.body?.events || []
  if (events.length) {
    console.log(
      '[webhook] events',
      events.map((e) => ({ type: e.type, userId: e.source?.userId, msg: e.type === 'message' && 'message' in e ? e.message.type : undefined }))
    )
  }
  res.status(200).json({ ok: true })
  if (events.length) {
    handleLineEvents(events).catch((e) => console.error('[webhook] handler error', e))
  }
})

export default router
