import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { isOwnerWriteBlocked, refreshOwnerSubscriptionStatus } from '../services/subscriptionService'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Block Owner write APIs when subscription is SUSPENDED (reads still allowed). */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'OWNER' || !req.user.ownerId) return next()
  if (!WRITE_METHODS.has(req.method.toUpperCase())) return next()

  // Always allow paying / uploading subscription slip
  const path = req.path || ''
  const original = req.originalUrl || ''
  if (original.includes('/subscriptions') || path.includes('/subscriptions')) return next()
  if (original.includes('/auth/password') || original.includes('/auth/me')) return next()

  try {
    const owner = await refreshOwnerSubscriptionStatus(req.user.ownerId)
    if (owner && isOwnerWriteBlocked(owner.subscriptionStatus)) {
      return res.status(403).json({
        error: 'บัญชีถูกระงับชั่วคราว กรุณาชำระค่าบริการเพื่อเปิดใช้งานต่อ',
        code: 'SUBSCRIPTION_SUSPENDED',
        subscriptionStatus: owner.subscriptionStatus,
        expiresAt: owner.expiresAt,
      })
    }
  } catch (e) {
    console.error('[subscription guard]', (e as Error).message)
  }
  next()
}
