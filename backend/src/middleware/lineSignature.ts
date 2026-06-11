import { middleware } from '@line/bot-sdk'
import { Request, Response, NextFunction } from 'express'
import { env, isLineConfigured } from '../lib/env'

/**
 * LINE webhook signature verification middleware.
 * When LINE is not configured (dev/mock), we skip verification and just parse JSON.
 */
export function lineSignatureMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isLineConfigured) {
    return next()
  }
  return middleware({
    channelSecret: env.LINE_CHANNEL_SECRET,
  })(req, res, next as never)
}
