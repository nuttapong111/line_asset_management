import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import {
  pushRentReminder,
  pushOverdue,
  pushContractExpiry,
  pushText,
} from '../lib/line/lineService'
import { buildAndSendRentForUnit } from './invoiceService'
import { billingMonthsAround, shouldSendRentInvoiceToday } from './billingSchedule'
import { linkedTenant } from '../services/tenantLifecycle'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export function isQuietHour(current: string, start: string, end: string): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const c = toMin(current)
  const s = toMin(start)
  const e = toMin(end)
  if (s === e) return false
  if (s < e) return c >= s && c < e
  return c >= s || c < e
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

type BillingNotif = {
  invoiceEnabled: boolean
  invoiceDaysBeforeDue: number
  invoiceSendTime: string
  rentReminderEnabled: boolean
  rentReminderDays: number[]
  rentReminderTime: string
  overdueEnabled: boolean
  overdueRepeatDays: number
  overdueSendTime: string
  contractEnabled: boolean
  contractReminderDays: number[]
  contractSendTime: string
  notifyTenant: boolean
  maintEnabled: boolean
  maintUnackHours: number
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
}

/** Auto-create rent invoices for units whose send day = today (dueDay − daysBefore). */
export async function sendDueRentInvoices(
  propertyWhere: { ownerId: string } | { adminId: string; ownerId: null },
  daysBefore: number,
  now = new Date()
): Promise<void> {
  const units = await prisma.unit.findMany({
    where: {
      property: propertyWhere,
      status: 'OCCUPIED',
      contracts: { some: { status: 'ACTIVE' } },
      tenants: { some: { isActive: true } },
    },
    include: {
      contracts: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  for (const unit of units) {
    const contract = unit.contracts[0]
    if (!contract) continue
    const dueDay = contract.dueDay ?? 5
    for (const { year, month } of billingMonthsAround(now)) {
      if (
        !shouldSendRentInvoiceToday({
          today: now,
          dueDay,
          daysBefore,
          contractStart: contract.startDate,
          year,
          month,
        })
      ) {
        continue
      }
      try {
        await buildAndSendRentForUnit(unit.id, month, year)
      } catch (e) {
        console.error(`[scheduler] rent invoice unit ${unit.id} ${year}-${month}:`, (e as Error).message)
      }
    }
  }
}

type PropertyScope = { ownerId?: string | null; adminId?: string }

export async function sendRentReminders(
  propertyWhere: PropertyScope,
  daysAhead: number
): Promise<void> {
  const target = startOfDay(addDays(new Date(), daysAhead))
  const next = addDays(target, 1)
  const invoices = await prisma.invoice.findMany({
    where: {
      status: 'PENDING',
      type: 'RENT',
      dueDate: { gte: target, lt: next },
      unit: { property: propertyWhere },
    },
    include: { unit: { include: { tenants: { where: { isActive: true } } } } },
  })
  for (const inv of invoices) {
    const t = linkedTenant(inv.unit.tenants)
    if (!t?.lineUserId) continue
    await pushRentReminder(t.lineUserId, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysLeft: daysAhead,
      amount: Number(inv.total),
      dueDate: inv.dueDate.toLocaleDateString('th-TH'),
      liffUrl: liff(`/payment/${inv.id}`),
    })
  }
}

export async function sendOverdueReminders(
  propertyWhere: PropertyScope,
  repeatDays: number
): Promise<void> {
  const today = startOfDay(new Date())
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { lt: today },
      unit: { property: propertyWhere },
    },
    include: {
      unit: {
        include: {
          tenants: { where: { isActive: true } },
          contracts: { where: { status: 'ACTIVE' } },
        },
      },
    },
  })
  for (const inv of invoices) {
    const daysLate = Math.floor((today.getTime() - startOfDay(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    if (daysLate <= 0 || daysLate % repeatDays !== 0) continue
    const t = linkedTenant(inv.unit.tenants)
    if (!t?.lineUserId) continue
    const lateFeePerDay = Number(inv.unit.contracts[0]?.lateFeePerDay ?? 30)
    const lateFee = daysLate * lateFeePerDay
    const baseTotal =
      Number(inv.rentAmount) +
      Number(inv.electricAmount) +
      Number(inv.waterAmount) +
      Number(inv.commonFee) +
      Number(inv.extraAmount)
    const total = baseTotal + lateFee
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { status: 'OVERDUE', lateFee, total },
    })
    await pushOverdue(t.lineUserId, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysOverdue: daysLate,
      originalAmount: baseTotal,
      lateFee,
      total,
      liffUrl: liff(`/payment/${inv.id}`),
    })
  }
}

export async function sendContractExpiryReminders(
  propertyWhere: PropertyScope,
  daysAhead: number,
  notifyTenant: boolean
): Promise<void> {
  const target = startOfDay(addDays(new Date(), daysAhead))
  const next = addDays(target, 1)
  const contracts = await prisma.contract.findMany({
    where: { status: 'ACTIVE', endDate: { gte: target, lt: next }, unit: { property: propertyWhere } },
    include: {
      unit: { include: { property: { include: { admin: true, owner: true } } } },
      tenant: true,
    },
  })
  for (const c of contracts) {
    const payload = {
      contractId: c.id,
      roomNumber: c.unit.roomNumber,
      tenantName: c.tenant.name,
      daysLeft: daysAhead,
      endDate: c.endDate.toLocaleDateString('th-TH'),
      renewUrl: liff(`/contract/${c.id}`),
      viewUrl: liff(`/contract/${c.id}`),
    }
    const ownerLine = c.unit.property.owner?.lineUserId
    const adminLine = c.unit.property.admin.lineUserId
    if (ownerLine) await pushContractExpiry(ownerLine, payload)
    else if (adminLine) await pushContractExpiry(adminLine, payload)
    if (notifyTenant && c.tenant.lineUserId) await pushContractExpiry(c.tenant.lineUserId, payload)
  }
}

export async function sendUnacknowledgedMaintReminders(
  propertyWhere: PropertyScope,
  hours: number
): Promise<void> {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000)
  const tickets = await prisma.maintenance.findMany({
    where: { status: 'NEW', createdAt: { lt: threshold }, unit: { property: propertyWhere } },
    include: {
      unit: {
        include: {
          property: { include: { admin: true, owner: true } },
          tenants: { where: { isActive: true } },
        },
      },
    },
  })
  for (const t of tickets) {
    const line =
      t.unit.property.owner?.lineUserId || t.unit.property.admin.lineUserId
    if (!line) continue
    await pushText(line, `⏰ แจ้งซ่อม ${t.ticketNo} (ห้อง ${t.unit.roomNumber}) ยังไม่มีผู้รับเรื่อง`)
  }
}

async function runOwnerBundle(s: BillingNotif, ownerId: string, HH_mm: string, now: Date) {
  if (s.quietEnabled && isQuietHour(HH_mm, s.quietStart, s.quietEnd)) return
  const scope = { ownerId }

  if (s.invoiceEnabled && HH_mm === s.invoiceSendTime) {
    await sendDueRentInvoices({ ownerId }, s.invoiceDaysBeforeDue, now)
  }
  if (s.rentReminderEnabled && HH_mm === s.rentReminderTime) {
    for (const d of s.rentReminderDays) await sendRentReminders(scope, d)
  }
  if (s.overdueEnabled && HH_mm === s.overdueSendTime) {
    await sendOverdueReminders(scope, s.overdueRepeatDays)
  }
  if (s.contractEnabled && HH_mm === s.contractSendTime) {
    for (const d of s.contractReminderDays) await sendContractExpiryReminders(scope, d, s.notifyTenant)
  }
  if (s.maintEnabled) {
    await sendUnacknowledgedMaintReminders(scope, s.maintUnackHours)
  }
}

/** Admin settings apply only to properties with no owner assigned. */
async function runAdminUnownedBundle(s: BillingNotif, adminId: string, HH_mm: string, now: Date) {
  if (s.quietEnabled && isQuietHour(HH_mm, s.quietStart, s.quietEnd)) return
  const unowned = { adminId, ownerId: null as null }

  if (s.invoiceEnabled && HH_mm === s.invoiceSendTime) {
    await sendDueRentInvoices(unowned, s.invoiceDaysBeforeDue, now)
  }
  if (s.rentReminderEnabled && HH_mm === s.rentReminderTime) {
    for (const d of s.rentReminderDays) await sendRentReminders(unowned, d)
  }
  if (s.overdueEnabled && HH_mm === s.overdueSendTime) {
    await sendOverdueReminders(unowned, s.overdueRepeatDays)
  }
  if (s.contractEnabled && HH_mm === s.contractSendTime) {
    for (const d of s.contractReminderDays) await sendContractExpiryReminders(unowned, d, s.notifyTenant)
  }
  if (s.maintEnabled) {
    await sendUnacknowledgedMaintReminders(unowned, s.maintUnackHours)
  }
}

async function tick(): Promise<void> {
  const now = new Date()
  const HH_mm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const { tickSubscriptionJobs } = await import('./subscriptionService')
  await tickSubscriptionJobs(HH_mm)

  // Per-owner settings (each landlord controls their properties)
  const owners = await prisma.owner.findMany({ include: { notifSettings: true } })
  for (const owner of owners) {
    let s = owner.notifSettings
    if (!s) {
      s = await prisma.ownerNotifSettings.create({ data: { ownerId: owner.id } })
    }
    await runOwnerBundle(s, owner.id, HH_mm, now)
  }

  // Admin settings only for properties not assigned to an owner
  const admins = await prisma.admin.findMany({ include: { notifSettings: true } })
  for (const admin of admins) {
    const s = admin.notifSettings
    if (!s) continue
    await runAdminUnownedBundle(
      { ...s, invoiceDaysBeforeDue: s.invoiceDaysBeforeDue ?? 4 },
      admin.id,
      HH_mm,
      now
    )
  }
}

export function startScheduler(): void {
  cron.schedule('0 * * * *', () => {
    tick().catch((e) => console.error('[scheduler] tick failed', e))
  })
  console.log('⏰ Notification scheduler started (hourly, owner due-day billing)')
}

/** @deprecated use sendDueRentInvoices — kept for tests/imports */
export async function sendInvoicesForAdmin(adminId: string): Promise<void> {
  const settings = await prisma.notifSettings.findUnique({ where: { adminId } })
  const daysBefore = settings?.invoiceDaysBeforeDue ?? 4
  await sendDueRentInvoices({ adminId, ownerId: null }, daysBefore)
}
