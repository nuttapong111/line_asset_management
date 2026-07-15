import { prisma } from '../lib/prisma'
import { env, liffEntryUrl } from '../lib/env'
import { uploadFile, readFile, extractStorageKey } from './storageService'
import { generatePromptPayPayload } from './qrService'
import {
  pushSubscriptionReminder,
  pushSubscriptionSlipReceived,
  pushSubscriptionResult,
  pushText,
} from '../lib/line/lineService'

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function trialExpiresAt(from = new Date()): Date {
  return addDays(from, env.SUBSCRIPTION_TRIAL_DAYS)
}

export function daysUntil(date: Date | null | undefined, from = new Date()): number | null {
  if (!date) return null
  const a = startOfDay(from).getTime()
  const b = startOfDay(date).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}

export function isOwnerWriteBlocked(status: string): boolean {
  return status === 'SUSPENDED'
}

export async function refreshOwnerSubscriptionStatus(ownerId: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } })
  if (!owner) return null

  const now = new Date()
  let status = owner.subscriptionStatus
  const expiresAt = owner.expiresAt

  if (!expiresAt) {
    // No expiry set — treat as trial starting now
    return prisma.owner.update({
      where: { id: ownerId },
      data: { expiresAt: trialExpiresAt(now), subscriptionStatus: 'TRIAL' },
    })
  }

  if (expiresAt >= startOfDay(now)) {
    if (status === 'GRACE' || status === 'SUSPENDED') {
      // Shouldn't happen if approved correctly; restore ACTIVE/TRIAL
      status = owner.subscriptionStatus === 'TRIAL' ? 'TRIAL' : 'ACTIVE'
    } else if (status !== 'TRIAL' && status !== 'ACTIVE') {
      status = 'ACTIVE'
    }
  } else {
    const graceEnd = addDays(expiresAt, env.SUBSCRIPTION_GRACE_DAYS)
    if (now <= graceEnd) {
      status = 'GRACE'
    } else {
      status = 'SUSPENDED'
    }
  }

  if (status !== owner.subscriptionStatus) {
    return prisma.owner.update({
      where: { id: ownerId },
      data: { subscriptionStatus: status },
    })
  }
  return owner
}

async function nextBillNo(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await prisma.subscriptionPayment.count({
    where: { createdAt: { gte: new Date(`${year}-01-01`) } },
  })
  return `SUB-${year}-${String(count + 1).padStart(5, '0')}`
}

/** Open bill for renewal (create or reuse pending/rejected). */
export async function ensureSubscriptionBill(ownerId: string) {
  const open = await prisma.subscriptionPayment.findFirst({
    where: {
      ownerId,
      status: { in: ['PENDING_SLIP', 'UNDER_REVIEW', 'REJECTED'] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (open && open.status !== 'REJECTED') return open
  // Rejected → allow new bill
  if (open?.status === 'REJECTED') {
    /* fall through to create */
  }

  return prisma.subscriptionPayment.create({
    data: {
      ownerId,
      billNo: await nextBillNo(),
      amount: env.SUBSCRIPTION_PRICE,
      periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
      status: 'PENDING_SLIP',
    },
  })
}

export async function getSubscriptionSummary(ownerId: string) {
  const owner = await refreshOwnerSubscriptionStatus(ownerId)
  if (!owner) return null
  const bill = await ensureSubscriptionBill(ownerId)
  const promptpay = env.PLATFORM_PROMPTPAY_NUMBER || env.DEFAULT_PROMPTPAY_NUMBER
  const amount = Number(bill.amount)
  const qrPayload = promptpay ? generatePromptPayPayload(promptpay, amount) : null
  const daysLeft = daysUntil(owner.expiresAt)
  return {
    owner: {
      id: owner.id,
      name: owner.name,
      subscriptionStatus: owner.subscriptionStatus,
      expiresAt: owner.expiresAt,
      daysLeft,
      writeBlocked: isOwnerWriteBlocked(owner.subscriptionStatus),
    },
    bill: {
      id: bill.id,
      billNo: bill.billNo,
      amount,
      periodDays: bill.periodDays,
      status: bill.status,
      rejectReason: bill.rejectReason,
      slipUploadedAt: bill.slipUploadedAt,
    },
    payment: {
      promptpayNumber: promptpay || null,
      qrPayload,
      graceDays: env.SUBSCRIPTION_GRACE_DAYS,
      periodDays: env.SUBSCRIPTION_PERIOD_DAYS,
    },
  }
}

export async function uploadSubscriptionSlip(ownerId: string, paymentId: string, file: Express.Multer.File) {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: paymentId, ownerId },
    include: { owner: { include: { admin: true } } },
  })
  if (!payment) throw new Error('ไม่พบใบแจ้งหนี้ค่าบริการ')
  if (payment.status === 'APPROVED') throw new Error('ชำระและอนุมัติแล้ว')

  const key = `subscription-slips/${ownerId}/${Date.now()}.jpg`
  const slipUrl = await uploadFile(key, file.buffer, file.mimetype)
  const updated = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      slipUrl,
      slipUploadedAt: new Date(),
      status: 'UNDER_REVIEW',
      rejectReason: null,
      rejectedAt: null,
    },
  })

  const adminLine = payment.owner.admin.lineUserId
  const payUrl = `${env.BACKEND_URL.replace(/\/$/, '')}/portal/subscriptions`
  const liffReview = env.LIFF_ID
    ? `${liffEntryUrl}/admin/subscriptions`
    : payUrl

  if (adminLine) {
    await pushSubscriptionSlipReceived(adminLine, {
      paymentId: updated.id,
      billNo: updated.billNo,
      ownerName: payment.owner.name,
      amount: Number(updated.amount),
      reviewUrl: liffReview,
    })
  }

  return updated
}

export async function approveSubscriptionPayment(paymentId: string, adminId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { owner: true },
  })
  if (!payment) throw new Error('ไม่พบรายการ')
  if (payment.owner.adminId !== adminId) throw new Error('ไม่มีสิทธิ์')
  if (payment.status !== 'UNDER_REVIEW') throw new Error('สถานะไม่พร้อมอนุมัติ')

  const base =
    payment.owner.expiresAt && payment.owner.expiresAt > new Date()
      ? payment.owner.expiresAt
      : new Date()
  const extendsTo = addDays(base, payment.periodDays)

  const [updated] = await prisma.$transaction([
    prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        extendsTo,
      },
    }),
    prisma.owner.update({
      where: { id: payment.ownerId },
      data: {
        expiresAt: extendsTo,
        subscriptionStatus: 'ACTIVE',
        subscriptionReminderKey: null,
      },
    }),
  ])

  if (payment.owner.lineUserId) {
    await pushSubscriptionResult(payment.owner.lineUserId, {
      ok: true,
      ownerName: payment.owner.name,
      billNo: payment.billNo,
      amount: Number(payment.amount),
      expiresAt: extendsTo.toLocaleDateString('th-TH'),
      reason: null,
    })
  }

  return updated
}

export async function rejectSubscriptionPayment(paymentId: string, adminId: string, reason?: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { owner: true },
  })
  if (!payment) throw new Error('ไม่พบรายการ')
  if (payment.owner.adminId !== adminId) throw new Error('ไม่มีสิทธิ์')
  if (payment.status !== 'UNDER_REVIEW') throw new Error('สถานะไม่พร้อมปฏิเสธ')

  const updated = await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectReason: reason || 'สลิปไม่ถูกต้อง',
    },
  })

  if (payment.owner.lineUserId) {
    await pushSubscriptionResult(payment.owner.lineUserId, {
      ok: false,
      ownerName: payment.owner.name,
      billNo: payment.billNo,
      amount: Number(payment.amount),
      expiresAt: payment.owner.expiresAt?.toLocaleDateString('th-TH') || '-',
      reason: updated.rejectReason,
    })
  }

  return updated
}

export async function readSubscriptionSlip(paymentId: string, adminId: string) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    include: { owner: true },
  })
  if (!payment?.slipUrl) return null
  if (payment.owner.adminId !== adminId) return null
  return readFile(extractStorageKey(payment.slipUrl))
}

/** Hourly: refresh statuses + send LINE reminders at configured time */
export async function tickSubscriptionJobs(HH_mm: string): Promise<void> {
  const owners = await prisma.owner.findMany()
  for (const o of owners) {
    await refreshOwnerSubscriptionStatus(o.id)
  }

  if (HH_mm !== env.SUBSCRIPTION_REMIND_TIME) return

  const portalPayUrl = `${env.BACKEND_URL.replace(/\/$/, '')}/portal/subscription`
  const payUrl = env.LIFF_ID ? `${liffEntryUrl}/admin/subscription` : portalPayUrl

  for (const daysAhead of env.SUBSCRIPTION_REMIND_DAYS) {
    const target = startOfDay(addDays(new Date(), daysAhead))
    const next = addDays(target, 1)
    const due = await prisma.owner.findMany({
      where: {
        expiresAt: { gte: target, lt: next },
        subscriptionStatus: { in: ['TRIAL', 'ACTIVE', 'GRACE'] },
        lineUserId: { not: null },
      },
    })

    for (const owner of due) {
      if (!owner.lineUserId || !owner.expiresAt) continue
      const key = `${owner.expiresAt.toISOString().slice(0, 10)}:${daysAhead}`
      if (owner.subscriptionReminderKey === key) continue

      const bill = await ensureSubscriptionBill(owner.id)
      await pushSubscriptionReminder(owner.lineUserId, {
        ownerName: owner.name,
        daysLeft: daysAhead,
        expiresAt: owner.expiresAt.toLocaleDateString('th-TH'),
        amount: Number(bill.amount),
        billNo: bill.billNo,
        payUrl,
        status: owner.subscriptionStatus,
      })
      await prisma.owner.update({
        where: { id: owner.id },
        data: { subscriptionReminderKey: key },
      })
    }
  }

  // Grace day 0 reminder (expired today)
  const today = startOfDay(new Date())
  const expiredToday = await prisma.owner.findMany({
    where: {
      expiresAt: { gte: today, lt: addDays(today, 1) },
      subscriptionStatus: { in: ['GRACE', 'ACTIVE', 'TRIAL'] },
      lineUserId: { not: null },
    },
  })
  // Already covered by daysAhead 0 if in list — add 0 to remind days via GRACE push
  const graceOwners = await prisma.owner.findMany({
    where: { subscriptionStatus: 'GRACE', lineUserId: { not: null } },
  })
  for (const owner of graceOwners) {
    if (!owner.lineUserId || !owner.expiresAt) continue
    const daysOver = Math.abs(daysUntil(owner.expiresAt) ?? 0)
    const key = `grace:${owner.expiresAt.toISOString().slice(0, 10)}:${startOfDay(new Date()).toISOString().slice(0, 10)}`
    if (owner.subscriptionReminderKey === key) continue
    // Remind once per calendar day while in grace
    const bill = await ensureSubscriptionBill(owner.id)
    await pushSubscriptionReminder(owner.lineUserId, {
      ownerName: owner.name,
      daysLeft: -daysOver,
      expiresAt: owner.expiresAt.toLocaleDateString('th-TH'),
      amount: Number(bill.amount),
      billNo: bill.billNo,
      payUrl,
      status: 'GRACE',
    })
    await prisma.owner.update({ where: { id: owner.id }, data: { subscriptionReminderKey: key } })
  }

  // Notify newly suspended
  const suspended = await prisma.owner.findMany({
    where: { subscriptionStatus: 'SUSPENDED', lineUserId: { not: null } },
  })
  for (const owner of suspended) {
    if (!owner.lineUserId || !owner.expiresAt) continue
    const key = `suspended:${owner.expiresAt.toISOString().slice(0, 10)}`
    if (owner.subscriptionReminderKey === key) continue
    await pushText(
      owner.lineUserId,
      `บัญชี PropFlow ของคุณถูกระงับชั่วคราวเนื่องจากเลยกำหนดชำระค่าบริการแล้ว\nกรุณาชำระที่ ${payUrl} แล้วรอแอดมินอนุมัติเพื่อเปิดใช้งานต่อ`
    )
    await prisma.owner.update({ where: { id: owner.id }, data: { subscriptionReminderKey: key } })
  }

  void expiredToday
}
