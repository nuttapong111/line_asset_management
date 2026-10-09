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

export type OwnerPlanType = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'PERMANENT'

export function trialExpiresAt(from = new Date()): Date {
  return addDays(from, env.SUBSCRIPTION_TRIAL_DAYS)
}

export function planPeriodDays(plan: OwnerPlanType): number | null {
  if (plan === 'PERMANENT') return null
  if (plan === 'MONTHLY') return env.SUBSCRIPTION_PERIOD_DAYS
  if (plan === 'YEARLY') return env.SUBSCRIPTION_YEARLY_DAYS
  return env.SUBSCRIPTION_TRIAL_DAYS
}

/** Fields to apply when admin grants a plan (create or change). */
export function grantPlanFields(plan: OwnerPlanType, from = new Date()) {
  if (plan === 'PERMANENT') {
    return {
      plan: 'PERMANENT' as const,
      subscriptionStatus: 'ACTIVE' as const,
      trialStartedAt: from,
      expiresAt: null as Date | null,
      subscriptionReminderKey: null as string | null,
    }
  }
  if (plan === 'MONTHLY' || plan === 'YEARLY') {
    const days = planPeriodDays(plan)!
    return {
      plan,
      subscriptionStatus: 'ACTIVE' as const,
      trialStartedAt: from,
      expiresAt: addDays(from, days),
      subscriptionReminderKey: null as string | null,
    }
  }
  // TRIAL — clock starts on first login / LINE link
  return {
    plan: 'TRIAL' as const,
    subscriptionStatus: 'TRIAL' as const,
    trialStartedAt: null as Date | null,
    expiresAt: null as Date | null,
    subscriptionReminderKey: null as string | null,
  }
}

/** Start the trial clock on first portal login or LINE link — not when admin creates the account. */
export async function activateOwnerTrial(ownerId: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } })
  if (!owner) return null

  if (owner.plan === 'PERMANENT') {
    return prisma.owner.update({
      where: { id: ownerId },
      data: {
        trialStartedAt: owner.trialStartedAt ?? new Date(),
        expiresAt: null,
        subscriptionStatus: 'ACTIVE',
        subscriptionReminderKey: null,
      },
    })
  }

  const paid = await prisma.subscriptionPayment.findFirst({
    where: { ownerId, status: 'APPROVED' },
  })
  if (paid) return refreshOwnerSubscriptionStatus(ownerId)
  if (owner.trialStartedAt) return refreshOwnerSubscriptionStatus(ownerId)

  const now = new Date()
  if (owner.plan === 'MONTHLY' || owner.plan === 'YEARLY') {
    return prisma.owner.update({
      where: { id: ownerId },
      data: grantPlanFields(owner.plan, now),
    })
  }

  return prisma.owner.update({
    where: { id: ownerId },
    data: {
      trialStartedAt: now,
      expiresAt: trialExpiresAt(now),
      subscriptionStatus: 'TRIAL',
      subscriptionReminderKey: null,
    },
  })
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

  if (owner.plan === 'PERMANENT') {
    if (owner.subscriptionStatus !== 'ACTIVE' || owner.expiresAt != null) {
      return prisma.owner.update({
        where: { id: ownerId },
        data: {
          subscriptionStatus: 'ACTIVE',
          expiresAt: null,
          trialStartedAt: owner.trialStartedAt ?? new Date(),
          subscriptionReminderKey: null,
        },
      })
    }
    return owner
  }

  const now = new Date()
  let status = owner.subscriptionStatus
  const expiresAt = owner.expiresAt

  if (!expiresAt || !owner.trialStartedAt) {
    // Not activated yet — do not start or expire the trial from cron / other reads
    return owner
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

/** Open bill for renewal (create or reuse pending/rejected). Permanent owners never get bills. */
export async function ensureSubscriptionBill(ownerId: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } })
  if (!owner || owner.plan === 'PERMANENT') return null

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

  const periodDays =
    owner.plan === 'YEARLY' ? env.SUBSCRIPTION_YEARLY_DAYS : env.SUBSCRIPTION_PERIOD_DAYS

  return prisma.subscriptionPayment.create({
    data: {
      ownerId,
      billNo: await nextBillNo(),
      amount: env.SUBSCRIPTION_PRICE,
      periodDays,
      status: 'PENDING_SLIP',
    },
  })
}

export async function getSubscriptionSummary(ownerId: string) {
  const owner = await refreshOwnerSubscriptionStatus(ownerId)
  if (!owner) return null
  const bill = await ensureSubscriptionBill(ownerId)
  const promptpay = env.PLATFORM_PROMPTPAY_NUMBER || env.DEFAULT_PROMPTPAY_NUMBER
  const amount = bill ? Number(bill.amount) : 0
  const qrPayload = bill && promptpay ? generatePromptPayPayload(promptpay, amount) : null
  const daysLeft = owner.plan === 'PERMANENT' ? null : daysUntil(owner.expiresAt)
  return {
    owner: {
      id: owner.id,
      name: owner.name,
      plan: owner.plan,
      subscriptionStatus: owner.subscriptionStatus,
      expiresAt: owner.expiresAt,
      daysLeft,
      writeBlocked: isOwnerWriteBlocked(owner.subscriptionStatus),
      permanent: owner.plan === 'PERMANENT',
    },
    bill: bill
      ? {
          id: bill.id,
          billNo: bill.billNo,
          amount,
          periodDays: bill.periodDays,
          status: bill.status,
          rejectReason: bill.rejectReason,
          slipUploadedAt: bill.slipUploadedAt,
        }
      : null,
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
        plan:
          payment.periodDays >= env.SUBSCRIPTION_YEARLY_DAYS
            ? 'YEARLY'
            : payment.owner.plan === 'PERMANENT'
              ? 'PERMANENT'
              : 'MONTHLY',
        expiresAt: extendsTo,
        subscriptionStatus: 'ACTIVE',
        trialStartedAt: payment.owner.trialStartedAt ?? new Date(),
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
        plan: { not: 'PERMANENT' },
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
      if (!bill) continue
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
    where: { plan: { not: 'PERMANENT' }, subscriptionStatus: 'GRACE', lineUserId: { not: null } },
  })
  for (const owner of graceOwners) {
    if (!owner.lineUserId || !owner.expiresAt) continue
    const daysOver = Math.abs(daysUntil(owner.expiresAt) ?? 0)
    const key = `grace:${owner.expiresAt.toISOString().slice(0, 10)}:${startOfDay(new Date()).toISOString().slice(0, 10)}`
    if (owner.subscriptionReminderKey === key) continue
    // Remind once per calendar day while in grace
    const bill = await ensureSubscriptionBill(owner.id)
    if (!bill) continue
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
    where: { plan: { not: 'PERMANENT' }, subscriptionStatus: 'SUSPENDED', lineUserId: { not: null } },
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
