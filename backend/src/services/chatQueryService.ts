import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

const THAI_MONTHS = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

function baht(n: number): string {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function monthLabel(month: number, year: number): string {
  return `${THAI_MONTHS[month]} ${year + 543}`
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '')
}

type ManagerCtx = { role: 'ADMIN' | 'OWNER'; adminId: string; ownerId: string | null; name: string }

function managerPropertyWhere(m: ManagerCtx): Prisma.PropertyWhereInput {
  if (m.role === 'OWNER') return { ownerId: m.ownerId ?? '__none__' }
  return { adminId: m.adminId }
}

type Intent =
  | 'TENANT_OVERDUE'
  | 'TENANT_BILLS'
  | 'TENANT_HELP'
  | 'MANAGER_REVENUE'
  | 'MANAGER_OVERDUE'
  | 'MANAGER_SLIPS'
  | 'MANAGER_OCCUPANCY'
  | 'MANAGER_HELP'

function detectIntent(text: string, role: 'TENANT' | 'MANAGER'): Intent | null {
  const t = normalize(text)

  if (/^(help|ช่วยเหลือ|คำสั่ง|เมนูช่วยเหลือ)$/.test(t)) {
    return role === 'TENANT' ? 'TENANT_HELP' : 'MANAGER_HELP'
  }

  if (role === 'TENANT') {
    if (/ค้างชำระ|ยอดค้าง|ค้างกี่|ค้างเท่า|ค้างอยู่|ค้างไว้|ค้างหนี้/.test(t)) return 'TENANT_OVERDUE'
    if (/ใบแจ้งหนี้|บิล|ต้องจ่าย|ค่าเช่า|ค้างจ่าย/.test(t)) return 'TENANT_BILLS'
    return null
  }

  if (/รายรับ|รายได้|สรุปรายรับ|เก็บได้|รับเงิน|รายรับเดือน/.test(t)) return 'MANAGER_REVENUE'
  if (/ค้างชำระ|ใครค้าง|ยอดค้าง|ลูกหนี้|ค้างทั้งหมด/.test(t)) return 'MANAGER_OVERDUE'
  if (/สลิป|รอตรวจ|รออนุมัติ|รอยืนยัน/.test(t)) return 'MANAGER_SLIPS'
  if (/ห้องว่าง|อัตราเข้าพัก|กี่ห้อง|occupancy|ห้องเช่า/.test(t)) return 'MANAGER_OCCUPANCY'
  return null
}

const UNPAID_STATUSES = ['PENDING', 'SLIP_UPLOADED', 'OVERDUE'] as const

async function tenantOverdue(_tenantId: string, unitId: string): Promise<string> {
  const invoices = await prisma.invoice.findMany({
    where: { unitId, status: { in: [...UNPAID_STATUSES] } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })

  if (!invoices.length) {
    return '✅ ไม่มียอดค้างชำระในขณะนี้ครับ'
  }

  const now = new Date()
  let total = 0
  const lines = invoices.map((inv) => {
    const amt = Number(inv.total)
    total += amt
    const overdue = inv.status === 'OVERDUE' || inv.dueDate < now
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    const status = overdue ? '🔴 ค้างชำระ' : '🟡 รอชำระ'
    return `• ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(amt)} (${status})`
  })

  return [
    '📋 สรุปยอดค้างชำระ',
    '',
    ...lines,
    '',
    `💰 รวมทั้งสิ้น ${baht(total)}`,
    '',
    'พิมพ์ "ชำระเงิน" เพื่อเปิดหน้าชำระ หรือเลือกจากเมนูด้านล่าง',
  ].join('\n')
}

async function tenantBills(_tenantId: string, unitId: string): Promise<string> {
  const invoices = await prisma.invoice.findMany({
    where: { unitId, status: { in: [...UNPAID_STATUSES] } },
    orderBy: [{ dueDate: 'asc' }],
    take: 5,
  })

  if (!invoices.length) {
    return '✅ ไม่มีใบแจ้งหนี้ที่ต้องชำระในขณะนี้ครับ'
  }

  const lines = invoices.map((inv) => {
    const due = inv.dueDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    return `• ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(Number(inv.total))}\n  ครบกำหนด ${due} (${inv.status})`
  })

  return ['📄 ใบแจ้งหนี้ที่ต้องชำระ', '', ...lines, '', 'พิมพ์ "ชำระเงิน" เพื่อชำระ'].join('\n')
}

function tenantHelp(): string {
  return [
    '🏠 คำสั่งสำหรับผู้เช่า',
    '',
    '• ค้างชำระ / ยอดค้าง — สรุปยอดที่ค้าง',
    '• ใบแจ้งหนี้ / บิล — รายการบิลที่ต้องจ่าย',
    '• ชำระเงิน — เปิดหน้าชำระ',
    '• ใบเสร็จล่าสุด — ดูใบเสร็จ',
    '• แจ้งซ่อม / สัญญา — เปิดเมนูที่เกี่ยวข้อง',
    '',
    'หรือพิมพ์ข้อความถามเจ้าของได้เลยครับ',
  ].join('\n')
}

async function managerRevenue(m: ManagerCtx): Promise<string> {
  const scope = managerPropertyWhere(m)
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [paid, pending, overdue] = await Promise.all([
    prisma.invoice.aggregate({
      where: { month, year, status: 'PAID', unit: { property: scope } },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: { month, year, status: { in: ['PENDING', 'SLIP_UPLOADED'] }, unit: { property: scope } },
      _sum: { total: true },
    }),
    prisma.invoice.aggregate({
      where: { month, year, status: 'OVERDUE', unit: { property: scope } },
      _sum: { total: true },
    }),
  ])

  const properties = await prisma.property.findMany({
    where: scope,
    include: {
      units: {
        include: {
          invoices: { where: { month, year, status: 'PAID' } },
        },
      },
    },
  })

  const byProperty = properties
    .map((p) => {
      const rev = p.units.reduce(
        (sum, u) => sum + u.invoices.reduce((s, i) => s + Number(i.total), 0),
        0
      )
      return { name: p.name, rev }
    })
    .filter((p) => p.rev > 0)

  const lines = byProperty.length
    ? byProperty.map((p) => `• ${p.name} — ${baht(p.rev)}`)
    : ['• ยังไม่มีรายรับที่บันทึกในเดือนนี้']

  return [
    `📊 สรุปรายรับ ${monthLabel(month, year)}`,
    '',
    `✅ รับแล้ว: ${baht(Number(paid._sum.total || 0))}`,
    `🟡 รอชำระ: ${baht(Number(pending._sum.total || 0))}`,
    `🔴 ค้างชำระ: ${baht(Number(overdue._sum.total || 0))}`,
    '',
    'ตามอาคาร:',
    ...lines,
  ].join('\n')
}

async function managerOverdue(m: ManagerCtx): Promise<string> {
  const scope = managerPropertyWhere(m)
  const now = new Date()

  const invoices = await prisma.invoice.findMany({
    where: {
      unit: { property: scope },
      status: { in: ['OVERDUE', 'PENDING', 'SLIP_UPLOADED'] },
      OR: [{ status: 'OVERDUE' }, { dueDate: { lt: now } }],
    },
    include: {
      unit: { include: { property: true, tenants: { where: { isActive: true }, take: 1 } } },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  if (!invoices.length) {
    return '✅ ไม่มียอดค้างชำระจากผู้เช่าในขณะนี้ครับ'
  }

  let total = 0
  const lines = invoices.map((inv) => {
    const amt = Number(inv.total)
    total += amt
    const tenant = inv.unit.tenants[0]?.name || '-'
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    return `• ${inv.unit.property.name} ห้อง ${inv.unit.roomNumber} (${tenant})\n  ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(amt)}`
  })

  const suffix =
    invoices.length >= 10 ? `\n\n(แสดง 10 รายการแรก — ดูทั้งหมดในแอป)` : ''

  return [
    '🔴 สรุปยอดค้างชำระ',
    '',
    ...lines,
    '',
    `💰 รวม ${baht(total)}${suffix}`,
  ].join('\n')
}

async function managerSlips(m: ManagerCtx): Promise<string> {
  const scope = managerPropertyWhere(m)

  const payments = await prisma.payment.findMany({
    where: {
      status: 'UNDER_REVIEW',
      invoice: { unit: { property: scope } },
    },
    include: {
      invoice: { include: { unit: { include: { property: true } } } },
      tenant: true,
    },
    orderBy: { slipUploadedAt: 'desc' },
    take: 10,
  })

  if (!payments.length) {
    return '✅ ไม่มีสลิปรอตรวจในขณะนี้ครับ'
  }

  const lines = payments.map((p) => {
    const inv = p.invoice
    return `• ${inv.unit.property.name} ห้อง ${inv.unit.roomNumber} (${p.tenant.name})\n  ${baht(Number(inv.total))} — รอตรวจ`
  })

  return ['📎 สลิปรอตรวจ/ยืนยัน', '', ...lines, '', 'เปิดแอป → ตรวจสลิป เพื่ออนุมัติ'].join('\n')
}

async function managerOccupancy(m: ManagerCtx): Promise<string> {
  const scope = managerPropertyWhere(m)

  const properties = await prisma.property.findMany({
    where: scope,
    include: { units: true },
  })

  if (!properties.length) {
    return 'ยังไม่มีอาคารในระบบครับ'
  }

  let totalUnits = 0
  let occupied = 0
  let vacant = 0

  const lines = properties.map((p) => {
    const total = p.units.length
    const occ = p.units.filter((u) => u.status === 'OCCUPIED').length
    const vac = p.units.filter((u) => u.status === 'VACANT').length
    totalUnits += total
    occupied += occ
    vacant += vac
    const rate = total ? Math.round((occ / total) * 100) : 0
    return `• ${p.name}\n  เข้าพัก ${occ}/${total} ห้อง (${rate}%) · ว่าง ${vac} ห้อง`
  })

  const overallRate = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0

  return [
    '🏢 สรุปห้องเช่า',
    '',
    ...lines,
    '',
    `รวม: เข้าพัก ${occupied}/${totalUnits} ห้อง (${overallRate}%) · ว่าง ${vacant} ห้อง`,
  ].join('\n')
}

function managerHelp(): string {
  return [
    '👔 คำสั่งสำหรับผู้ดูแล/เจ้าของ',
    '',
    '• สรุปรายรับ / รายได้ — รายรับเดือนนี้',
    '• ค้างชำระ / ใครค้าง — รายการยอดค้าง',
    '• สลิป / รอตรวจ — สลิปรอยืนยัน',
    '• ห้องว่าง / กี่ห้อง — อัตราเข้าพัก',
    '• เปิดระบบ — เปิดแอปจัดการ',
    '',
    'พิมพ์คำถามเป็นภาษาไทยได้เลยครับ',
  ].join('\n')
}

/** Try to answer a natural-language question. Returns null if no intent matched. */
export async function tryAnswerChatQuery(
  text: string,
  ctx:
    | { role: 'TENANT'; tenantId: string; unitId: string }
    | { role: 'MANAGER'; manager: ManagerCtx }
): Promise<string | null> {
  const role = ctx.role === 'TENANT' ? 'TENANT' : 'MANAGER'
  const intent = detectIntent(text, role)
  if (!intent) return null

  switch (intent) {
    case 'TENANT_OVERDUE':
      if (ctx.role !== 'TENANT') return null
      return tenantOverdue(ctx.tenantId, ctx.unitId)
    case 'TENANT_BILLS':
      if (ctx.role !== 'TENANT') return null
      return tenantBills(ctx.tenantId, ctx.unitId)
    case 'TENANT_HELP':
      return tenantHelp()
    case 'MANAGER_REVENUE':
      if (ctx.role !== 'MANAGER') return null
      return managerRevenue(ctx.manager)
    case 'MANAGER_OVERDUE':
      if (ctx.role !== 'MANAGER') return null
      return managerOverdue(ctx.manager)
    case 'MANAGER_SLIPS':
      if (ctx.role !== 'MANAGER') return null
      return managerSlips(ctx.manager)
    case 'MANAGER_OCCUPANCY':
      if (ctx.role !== 'MANAGER') return null
      return managerOccupancy(ctx.manager)
    case 'MANAGER_HELP':
      return managerHelp()
    default:
      return null
  }
}

export type { ManagerCtx }

export async function resolveManagerByLineUserId(lineUserId: string): Promise<ManagerCtx | null> {
  const admin = await prisma.admin.findUnique({ where: { lineUserId } })
  if (admin) return { role: 'ADMIN', adminId: admin.id, ownerId: null, name: admin.name }

  const owner = await prisma.owner.findFirst({
    where: { lineUserId, linkedAt: { not: null } },
  })
  if (owner) return { role: 'OWNER', adminId: owner.adminId, ownerId: owner.id, name: owner.name }

  return null
}
