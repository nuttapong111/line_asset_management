import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import {
  pushRentReminder,
  pushOverdue,
  pushContractExpiry,
  pushMaintNew,
  pushText,
} from '../lib/line/lineService'
import { buildAndSendRentForProperty } from './invoiceService'
import { linkedTenant } from '../services/tenantLifecycle'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

export function isQuietHour(current: string, start: string, end: string): boolean {
  // current/start/end in "HH:mm"
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }
  const c = toMin(current)
  const s = toMin(start)
  const e = toMin(end)
  if (s === e) return false
  if (s < e) return c >= s && c < e
  // overnight (e.g. 22:00 → 07:00)
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

export async function sendInvoicesForAdmin(adminId: string): Promise<void> {
  const props = await prisma.property.findMany({ where: { adminId } })
  const now = new Date()
  for (const p of props) {
    await buildAndSendRentForProperty(p.id, now.getMonth() + 1, now.getFullYear())
  }
}

export async function sendRentReminders(adminId: string, daysAhead: number): Promise<void> {
  const target = startOfDay(addDays(new Date(), daysAhead))
  const next = addDays(target, 1)
  const invoices = await prisma.invoice.findMany({
    where: {
      status: 'PENDING',
      dueDate: { gte: target, lt: next },
      unit: { property: { adminId } },
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

export async function sendOverdueReminders(adminId: string, repeatDays: number): Promise<void> {
  const today = startOfDay(new Date())
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ['PENDING', 'OVERDUE'] },
      dueDate: { lt: today },
      unit: { property: { adminId } },
    },
    include: {
      unit: { include: { tenants: { where: { isActive: true } }, contracts: { where: { status: 'ACTIVE' } } } },
    },
  })
  for (const inv of invoices) {
    const daysLate = Math.floor((today.getTime() - startOfDay(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    if (daysLate <= 0 || daysLate % repeatDays !== 0) continue
    const t = linkedTenant(inv.unit.tenants)
    if (!t?.lineUserId) continue
    const lateFeePerDay = Number(inv.unit.contracts[0]?.lateFeePerDay ?? 30)
    const lateFee = daysLate * lateFeePerDay
    const original = Number(inv.total)
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'OVERDUE', lateFee } })
    await pushOverdue(t.lineUserId, {
      invoiceId: inv.id,
      roomNumber: inv.unit.roomNumber,
      tenantName: t.name,
      daysOverdue: daysLate,
      originalAmount: original,
      lateFee,
      total: original + lateFee,
      liffUrl: liff(`/payment/${inv.id}`),
    })
  }
}

export async function sendContractExpiryReminders(
  adminId: string,
  daysAhead: number,
  notifyTenant: boolean
): Promise<void> {
  const target = startOfDay(addDays(new Date(), daysAhead))
  const next = addDays(target, 1)
  const contracts = await prisma.contract.findMany({
    where: { status: 'ACTIVE', endDate: { gte: target, lt: next }, unit: { property: { adminId } } },
    include: { unit: { include: { property: { include: { admin: true } } } }, tenant: true },
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
    const adminLine = c.unit.property.admin.lineUserId
    if (adminLine) await pushContractExpiry(adminLine, payload)
    if (notifyTenant && c.tenant.lineUserId) await pushContractExpiry(c.tenant.lineUserId, payload)
  }
}

export async function sendUnacknowledgedMaintReminders(adminId: string, hours: number): Promise<void> {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000)
  const tickets = await prisma.maintenance.findMany({
    where: { status: 'NEW', createdAt: { lt: threshold }, unit: { property: { adminId } } },
    include: { unit: { include: { property: { include: { admin: true } }, tenants: { where: { isActive: true } } } } },
  })
  for (const t of tickets) {
    const adminLine = t.unit.property.admin.lineUserId
    if (!adminLine) continue
    await pushText(adminLine, `⏰ แจ้งซ่อม ${t.ticketNo} (ห้อง ${t.unit.roomNumber}) ยังไม่มีผู้รับเรื่อง`)
  }
}

async function tick(): Promise<void> {
  const now = new Date()
  const HH_mm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const admins = await prisma.admin.findMany({ include: { notifSettings: true } })

  for (const admin of admins) {
    const s = admin.notifSettings
    if (!s) continue
    if (s.quietEnabled && isQuietHour(HH_mm, s.quietStart, s.quietEnd)) continue

    if (s.invoiceEnabled && HH_mm === s.invoiceSendTime && now.getDate() === s.invoiceSendDay) {
      await sendInvoicesForAdmin(admin.id)
    }
    if (s.rentReminderEnabled && HH_mm === s.rentReminderTime) {
      for (const d of s.rentReminderDays) await sendRentReminders(admin.id, d)
    }
    if (s.overdueEnabled && HH_mm === s.overdueSendTime) {
      await sendOverdueReminders(admin.id, s.overdueRepeatDays)
    }
    if (s.contractEnabled && HH_mm === s.contractSendTime) {
      for (const d of s.contractReminderDays) await sendContractExpiryReminders(admin.id, d, s.notifyTenant)
    }
    if (s.maintEnabled) {
      await sendUnacknowledgedMaintReminders(admin.id, s.maintUnackHours)
    }
  }
}

export function startScheduler(): void {
  // Every hour at minute 0
  cron.schedule('0 * * * *', () => {
    tick().catch((e) => console.error('[scheduler] tick failed', e))
  })
  console.log('⏰ Notification scheduler started (hourly)')
}
