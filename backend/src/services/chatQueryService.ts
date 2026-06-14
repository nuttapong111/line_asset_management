import { Prisma } from '@prisma/client'
import { TemplateMessage as LineTemplateMessage } from '@line/bot-sdk'
import { prisma } from '../lib/prisma'
import { buildLiffPathMessage, liffPath } from '../lib/line/liffHelpers'

const THAI_MONTHS = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

const UNPAID_STATUSES = ['PENDING', 'SLIP_UPLOADED', 'OVERDUE'] as const

const MAINT_OPEN = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SCHEDULED'] as const

const MAINT_STATUS_TH: Record<string, string> = {
  NEW: 'รอรับเรื่อง',
  ACKNOWLEDGED: 'รับเรื่องแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  SCHEDULED: 'นัดซ่อมแล้ว',
  DONE: 'เสร็จแล้ว',
  CLOSED: 'ปิดงาน',
}

function baht(n: number): string {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function monthLabel(month: number, year: number): string {
  return `${THAI_MONTHS[month]} ${year + 543}`
}

function thaiDate(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '')
}

function liff(path: string): string {
  return liffPath(path)
}

function liffBtn(path: string, label: string, text?: string): LineTemplateMessage {
  return buildLiffPathMessage(path, { label, text: text || label, title: 'PropFlow' })
}

type ManagerCtx = { role: 'ADMIN' | 'OWNER'; adminId: string; ownerId: string | null; name: string }

export type ChatQueryResult = { text: string; followUp?: LineTemplateMessage }

function managerPropertyWhere(m: ManagerCtx): Prisma.PropertyWhereInput {
  if (m.role === 'OWNER') return { ownerId: m.ownerId ?? '__none__' }
  return { adminId: m.adminId }
}

type Intent =
  | 'TENANT_SUMMARY'
  | 'TENANT_CONTRACT'
  | 'TENANT_RECEIPTS'
  | 'TENANT_MAINTENANCE'
  | 'TENANT_CONTACT'
  | 'TENANT_PAY'
  | 'TENANT_OVERDUE'
  | 'TENANT_BILLS'
  | 'TENANT_HELP'
  | 'MANAGER_DASHBOARD'
  | 'MANAGER_REVENUE'
  | 'MANAGER_REPORTS'
  | 'MANAGER_BILLING'
  | 'MANAGER_OVERDUE'
  | 'MANAGER_SLIPS'
  | 'MANAGER_OCCUPANCY'
  | 'MANAGER_HELP'

function detectIntent(text: string, role: 'TENANT' | 'MANAGER'): Intent | null {
  const t = normalize(text)

  if (/^(help|ช่วยเหลือ|คำสั่ง|เมนูช่วยเหลือ|คำถามที่ใช้ได้)$/.test(t)) {
    return role === 'TENANT' ? 'TENANT_HELP' : 'MANAGER_HELP'
  }

  if (role === 'TENANT') {
    if (/สัญญาเช่า|ขอดูสัญญา|ดูสัญญา|สัญญา|contract/.test(t)) return 'TENANT_CONTRACT'
    if (/dashboard|แดชบอร์ด|สรุปข้อมูล|ภาพรวม|หน้าหลัก|สถานะ|ข้อมูลของฉัน|ข้อมูลส่วนตัว/.test(t)) {
      return 'TENANT_SUMMARY'
    }
    if (/ใบเสร็จ|ประวัติการชำระ|ประวัติชำระ|รายการชำระ/.test(t)) return 'TENANT_RECEIPTS'
    if (/แจ้งซ่อม|สถานะซ่อม|งานซ่อม|ticket/.test(t)) return 'TENANT_MAINTENANCE'
    if (/ติดต่อ|เจ้าของ|โทร|promptpay|พร้อมเพย์/.test(t)) return 'TENANT_CONTACT'
    if (/ชำระเงิน|จ่ายเงิน|จ่ายค่าเช่า|โอนเงิน|qr/.test(t)) return 'TENANT_PAY'
    if (/ค้างชำระ|ยอดค้าง|ค้างกี่|ค้างเท่า|ค้างอยู่|ค้างไว้|ค้างหนี้/.test(t)) return 'TENANT_OVERDUE'
    if (/ใบแจ้งหนี้|บิล|ต้องจ่าย|ค้างจ่าย/.test(t)) return 'TENANT_BILLS'
    return null
  }

  if (/dashboard|แดชบอร์ด|สรุปข้อมูล|ภาพรวม|overview|ขอดูdashboard|หน้าหลัก/.test(t)) {
    return 'MANAGER_DASHBOARD'
  }
  if (/รายงานรายได้|ขอรายงาน|รายงาน|reports|report|export/.test(t)) return 'MANAGER_REPORTS'
  if (/บิล|ใบแจ้งหนี้|billing|ออกบิล/.test(t)) return 'MANAGER_BILLING'
  if (/รายรับ|รายได้|สรุปรายรับ|เก็บได้|รับเงิน|รายรับเดือน/.test(t)) return 'MANAGER_REVENUE'
  if (/ค้างชำระ|ใครค้าง|ยอดค้าง|ลูกหนี้|ค้างทั้งหมด/.test(t)) return 'MANAGER_OVERDUE'
  if (/สลิป|รอตรวจ|รออนุมัติ|รอยืนยัน/.test(t)) return 'MANAGER_SLIPS'
  if (/ห้องว่าง|อัตราเข้าพัก|กี่ห้อง|occupancy/.test(t)) return 'MANAGER_OCCUPANCY'
  return null
}

async function tenantSummary(tenantId: string, unitId: string): Promise<ChatQueryResult> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      property: true,
      tenants: { where: { id: tenantId } },
    },
  })
  if (!unit) return { text: 'ไม่พบข้อมูลห้องครับ' }

  const [unpaid, openMaint, lastPaid] = await Promise.all([
    prisma.invoice.aggregate({
      where: { unitId, status: { in: [...UNPAID_STATUSES] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.maintenance.count({ where: { unitId, status: { in: [...MAINT_OPEN] } } }),
    prisma.payment.findFirst({
      where: { tenantId, status: 'APPROVED' },
      orderBy: { approvedAt: 'desc' },
      include: { invoice: true },
    }),
  ])

  const tenant = unit.tenants[0]
  const lines = [
    '🏠 สรุปข้อมูลผู้เช่า',
    '',
    `ชื่อ: ${tenant?.name || '-'}`,
    `อาคาร: ${unit.property.name}`,
    `ห้อง: ${unit.roomNumber}`,
    `ค่าเช่า: ${baht(Number(unit.rentPrice))}/เดือน`,
    '',
    `📋 บิลค้าง: ${unpaid._count} รายการ · ${baht(Number(unpaid._sum.total || 0))}`,
    `🔧 งานซ่อมเปิด: ${openMaint} รายการ`,
  ]

  if (lastPaid) {
    lines.push(
      `✅ ชำระล่าสุด: ${baht(Number(lastPaid.invoice.total))} (${lastPaid.approvedAt ? thaiDate(lastPaid.approvedAt) : '-'})`
    )
  }

  lines.push('', `เปิดหน้าหลัก: ${liff('/tenant/home')}`)

  return {
    text: lines.join('\n'),
    followUp: liffBtn('/tenant/home', 'เปิดหน้าหลัก', 'ดูรายละเอียดและบิลทั้งหมด'),
  }
}

async function tenantContract(tenantId: string): Promise<ChatQueryResult> {
  const contract = await prisma.contract.findFirst({
    where: { tenantId, status: 'ACTIVE' },
    include: { unit: { include: { property: true } } },
    orderBy: { endDate: 'desc' },
  })

  if (!contract) {
    return {
      text: 'ยังไม่มีสัญญาเช่าในระบบครับ\n\nติดต่อเจ้าของห้องเพื่อขอสัญญา',
    }
  }

  const daysLeft = Math.ceil((contract.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const expiryNote = daysLeft <= 60 ? `\n⚠️ สัญญาเหลือ ${daysLeft} วัน` : ''

  const text = [
    '📄 รายละเอียดสัญญาเช่า',
    '',
    `อาคาร: ${contract.unit.property.name}`,
    `ห้อง: ${contract.unit.roomNumber}`,
    `ค่าเช่า: ${baht(Number(contract.rentAmount))}/เดือน`,
    `เงินประกัน: ${baht(Number(contract.deposit))}`,
    `ระยะสัญญา: ${thaiDate(contract.startDate)} – ${thaiDate(contract.endDate)}`,
    `ครบกำหนดชำระ: วันที่ ${contract.dueDay} ของทุกเดือน`,
    `ค่าปรับล่าช้า: ${baht(Number(contract.lateFeePerDay))}/วัน`,
    contract.signedAt
      ? `✅ ลงนามแล้ว (${thaiDate(contract.signedAt)})`
      : '⏳ ยังไม่ได้แนบสัญญาที่ลงนาม',
    expiryNote,
    '',
    `เปิดดูเอกสาร: ${liff('/contract')}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    text,
    followUp: liffBtn('/contract', 'เปิดสัญญาเต็ม', 'ดู/ดาวน์โหลดสัญญาเช่า'),
  }
}

async function tenantReceipts(tenantId: string): Promise<ChatQueryResult> {
  const payments = await prisma.payment.findMany({
    where: { tenantId, status: 'APPROVED' },
    orderBy: { approvedAt: 'desc' },
    take: 5,
    include: { invoice: true },
  })

  if (!payments.length) {
    return { text: 'ยังไม่มีประวัติการชำระเงินครับ' }
  }

  const lines = payments.map((p) => {
    const inv = p.invoice
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    return `• ${p.receiptNo || '-'} · ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(Number(inv.total))}\n  ${p.approvedAt ? thaiDate(p.approvedAt) : '-'}`
  })

  return {
    text: ['🧾 ประวัติการชำระ (5 รายการล่าสุด)', '', ...lines, '', `ดูทั้งหมด: ${liff('/receipt')}`].join('\n'),
    followUp: liffBtn('/receipt', 'ดูใบเสร็จทั้งหมด'),
  }
}

async function tenantMaintenance(unitId: string): Promise<ChatQueryResult> {
  const tickets = await prisma.maintenance.findMany({
    where: { unitId, status: { in: [...MAINT_OPEN] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (!tickets.length) {
    return {
      text: '✅ ไม่มีงานแจ้งซ่อมที่เปิดอยู่ครับ\n\nพิมพ์ "แจ้งซ่อม" เพื่อเปิดแบบฟอร์ม',
      followUp: liffBtn('/maintenance/new', 'แจ้งซ่อมใหม่'),
    }
  }

  const lines = tickets.map(
    (t) => `• ${t.ticketNo} — ${t.title}\n  สถานะ: ${MAINT_STATUS_TH[t.status] || t.status}`
  )

  return {
    text: ['🔧 งานแจ้งซ่อมที่เปิดอยู่', '', ...lines, '', `ดูทั้งหมด: ${liff('/tenant/maintenance')}`].join('\n'),
    followUp: liffBtn('/tenant/maintenance', 'ดูรายการซ่อม'),
  }
}

async function tenantContact(unitId: string): Promise<ChatQueryResult> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: { include: { owner: true, admin: true } } },
  })
  if (!unit) return { text: 'ไม่พบข้อมูลครับ' }

  const owner = unit.property.owner
  const admin = unit.property.admin
  const managerName = owner?.name || admin.name
  const phone = owner?.phone || admin.phone || '-'

  return {
    text: [
      '📞 ข้อมูลติดต่อ',
      '',
      `อาคาร: ${unit.property.name}`,
      `ห้อง: ${unit.roomNumber}`,
      `ผู้ดูแล: ${managerName}`,
      `โทร: ${phone}`,
      `พร้อมเพย์: ${unit.property.promptpayNumber}`,
      unit.property.bankAccount
        ? `บัญชี: ${unit.property.bankName || ''} ${unit.property.bankAccount}`
        : '',
      '',
      `เปิดหน้าติดต่อ: ${liff('/contact')}`,
    ]
      .filter(Boolean)
      .join('\n'),
    followUp: liffBtn('/contact', 'เปิดหน้าติดต่อ'),
  }
}

function tenantPay(): ChatQueryResult {
  return {
    text: [`💳 ชำระค่าเช่า / ค่าน้ำไฟ`, '', `เปิดหน้าชำระเงิน: ${liff('/payment')}`, '', 'เลือกบิล → สแกน QR → แนบสลิป'].join('\n'),
    followUp: liffBtn('/payment', 'เปิดหน้าชำระเงิน'),
  }
}

async function tenantOverdue(_tenantId: string, unitId: string): Promise<ChatQueryResult> {
  const invoices = await prisma.invoice.findMany({
    where: { unitId, status: { in: [...UNPAID_STATUSES] } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })

  if (!invoices.length) {
    return { text: '✅ ไม่มียอดค้างชำระในขณะนี้ครับ' }
  }

  const now = new Date()
  let total = 0
  const lines = invoices.map((inv) => {
    const amt = Number(inv.total)
    total += amt
    const overdue = inv.status === 'OVERDUE' || inv.dueDate < now
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    const status = overdue ? '🔴 ค้างชำระ' : '🟡 รอชำระ'
    return `• ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(amt)}\n  ครบกำหนด ${thaiDate(inv.dueDate)} (${status})`
  })

  return {
    text: ['📋 สรุปยอดค้างชำระ', '', ...lines, '', `💰 รวมทั้งสิ้น ${baht(total)}`].join('\n'),
    followUp: liffBtn('/payment', 'ชำระเงินตอนนี้'),
  }
}

async function tenantBills(_tenantId: string, unitId: string): Promise<ChatQueryResult> {
  const invoices = await prisma.invoice.findMany({
    where: { unitId, status: { in: [...UNPAID_STATUSES] } },
    orderBy: [{ dueDate: 'asc' }],
    take: 5,
  })

  if (!invoices.length) {
    return { text: '✅ ไม่มีใบแจ้งหนี้ที่ต้องชำระในขณะนี้ครับ' }
  }

  const lines = invoices.map((inv) => {
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    return `• ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(Number(inv.total))}\n  ครบกำหนด ${thaiDate(inv.dueDate)} (${inv.status})`
  })

  return {
    text: ['📄 ใบแจ้งหนี้ที่ต้องชำระ', '', ...lines].join('\n'),
    followUp: liffBtn('/payment', 'เปิดหน้าชำระเงิน'),
  }
}

function tenantHelp(): ChatQueryResult {
  return {
    text: [
      '🏠 คำสั่งสำหรับผู้เช่า',
      '',
      '• สรุปข้อมูล / หน้าหลัก — ภาพรวมบัญชี',
      '• ขอดูสัญญาเช่า / สัญญา — รายละเอียดสัญญา',
      '• ค้างชำระ / ยอดค้าง — สรุปยอดที่ค้าง',
      '• ใบแจ้งหนี้ / บิล — รายการที่ต้องจ่าย',
      '• ชำระเงิน — เปิดหน้าชำระ + QR',
      '• ใบเสร็จ / ประวัติ — รายการชำระแล้ว',
      '• แจ้งซ่อม — สถานะงานซ่อม',
      '• ติดต่อ — เบอร์/PromptPay เจ้าของ',
      '',
      'พิมพ์ข้อความอื่นเพื่อส่งถึงเจ้าของได้เลยครับ',
    ].join('\n'),
  }
}

async function managerDashboard(m: ManagerCtx): Promise<ChatQueryResult> {
  const scope = managerPropertyWhere(m)
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [paid, pending, overdue, slipCount, properties] = await Promise.all([
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
    prisma.payment.count({
      where: { status: 'UNDER_REVIEW', invoice: { unit: { property: scope } } },
    }),
    prisma.property.findMany({ where: scope, include: { units: true } }),
  ])

  let totalUnits = 0
  let occupied = 0
  for (const p of properties) {
    totalUnits += p.units.length
    occupied += p.units.filter((u) => u.status === 'OCCUPIED').length
  }
  const occRate = totalUnits ? Math.round((occupied / totalUnits) * 100) : 0

  const text = [
    `📊 Dashboard — ${monthLabel(month, year)}`,
    '',
    `✅ รับแล้ว: ${baht(Number(paid._sum.total || 0))}`,
    `🟡 รอชำระ: ${baht(Number(pending._sum.total || 0))}`,
    `🔴 ค้างชำระ: ${baht(Number(overdue._sum.total || 0))}`,
    `📎 สลิปรอตรวจ: ${slipCount} รายการ`,
    `🏢 ห้องเข้าพัก: ${occupied}/${totalUnits} (${occRate}%)`,
    `🏠 อาคาร: ${properties.length} แห่ง`,
    '',
    `เปิด Dashboard: ${liff('/admin/portfolio')}`,
  ].join('\n')

  return {
    text,
    followUp: liffBtn('/admin/portfolio', 'เปิด Dashboard', 'จัดการอาคาร ห้อง และบิล'),
  }
}

async function managerRevenue(m: ManagerCtx): Promise<ChatQueryResult> {
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
      units: { include: { invoices: { where: { month, year, status: 'PAID' } } } },
    },
  })

  const byProperty = properties
    .map((p) => ({
      name: p.name,
      rev: p.units.reduce((sum, u) => sum + u.invoices.reduce((s, i) => s + Number(i.total), 0), 0),
    }))
    .filter((p) => p.rev > 0)

  const lines = byProperty.length
    ? byProperty.map((p) => `• ${p.name} — ${baht(p.rev)}`)
    : ['• ยังไม่มีรายรับที่บันทึกในเดือนนี้']

  return {
    text: [
      `📊 สรุปรายรับ ${monthLabel(month, year)}`,
      '',
      `✅ รับแล้ว: ${baht(Number(paid._sum.total || 0))}`,
      `🟡 รอชำระ: ${baht(Number(pending._sum.total || 0))}`,
      `🔴 ค้างชำระ: ${baht(Number(overdue._sum.total || 0))}`,
      '',
      'ตามอาคาร:',
      ...lines,
    ].join('\n'),
    followUp: liffBtn('/admin/reports', 'ดูรายงานเต็ม'),
  }
}

async function managerReports(m: ManagerCtx): Promise<ChatQueryResult> {
  const dash = await managerDashboard(m)
  return {
    text: [
      dash.text,
      '',
      '📈 ดูกราฟรายรับและ export CSV ได้ในเมนูรายงาน',
      `เปิดรายงาน: ${liff('/admin/reports')}`,
    ].join('\n'),
    followUp: liffBtn('/admin/reports', 'เปิดรายงาน', 'กราฟรายรับ + Export'),
  }
}

async function managerBilling(m: ManagerCtx): Promise<ChatQueryResult> {
  const scope = managerPropertyWhere(m)
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  const [pendingCount, overdueCount, slipCount] = await Promise.all([
    prisma.invoice.count({
      where: { month, year, status: { in: ['PENDING', 'SLIP_UPLOADED'] }, unit: { property: scope } },
    }),
    prisma.invoice.count({ where: { status: 'OVERDUE', unit: { property: scope } } }),
    prisma.payment.count({
      where: { status: 'UNDER_REVIEW', invoice: { unit: { property: scope } } },
    }),
  ])

  return {
    text: [
      '📋 สรุปบิล / ใบแจ้งหนี้',
      '',
      `🟡 รอชำระเดือนนี้: ${pendingCount} รายการ`,
      `🔴 ค้างชำระ: ${overdueCount} รายการ`,
      `📎 สลิปรอตรวจ: ${slipCount} รายการ`,
      '',
      `เปิดหน้าบิล: ${liff('/admin/billing')}`,
    ].join('\n'),
    followUp: liffBtn('/admin/billing', 'เปิดหน้าบิล', 'ดู/จัดการใบแจ้งหนี้ทั้งหมด'),
  }
}

async function managerOverdue(m: ManagerCtx): Promise<ChatQueryResult> {
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
    return { text: '✅ ไม่มียอดค้างชำระจากผู้เช่าในขณะนี้ครับ' }
  }

  let total = 0
  const lines = invoices.map((inv) => {
    const amt = Number(inv.total)
    total += amt
    const tenant = inv.unit.tenants[0]?.name || '-'
    const typeLabel = inv.type === 'RENT' ? 'ค่าเช่า' : 'ค่าน้ำไฟ'
    return `• ${inv.unit.property.name} ห้อง ${inv.unit.roomNumber} (${tenant})\n  ${typeLabel} ${monthLabel(inv.month, inv.year)} — ${baht(amt)} · ครบ ${thaiDate(inv.dueDate)}`
  })

  const suffix = invoices.length >= 10 ? '\n\n(แสดง 10 รายการแรก)' : ''

  return {
    text: ['🔴 สรุปยอดค้างชำระ', '', ...lines, '', `💰 รวม ${baht(total)}${suffix}`].join('\n'),
    followUp: liffBtn('/admin/billing', 'ดูบิลทั้งหมด'),
  }
}

async function managerSlips(m: ManagerCtx): Promise<ChatQueryResult> {
  const scope = managerPropertyWhere(m)

  const payments = await prisma.payment.findMany({
    where: { status: 'UNDER_REVIEW', invoice: { unit: { property: scope } } },
    include: {
      invoice: { include: { unit: { include: { property: true } } } },
      tenant: true,
    },
    orderBy: { slipUploadedAt: 'desc' },
    take: 10,
  })

  if (!payments.length) {
    return { text: '✅ ไม่มีสลิปรอตรวจในขณะนี้ครับ' }
  }

  const lines = payments.map((p) => {
    const inv = p.invoice
    return `• ${inv.unit.property.name} ห้อง ${inv.unit.roomNumber} (${p.tenant.name})\n  ${baht(Number(inv.total))} · อัปโหลด ${p.slipUploadedAt ? thaiDate(p.slipUploadedAt) : '-'}`
  })

  const first = payments[0]

  return {
    text: ['📎 สลิปรอตรวจ/ยืนยัน', '', ...lines].join('\n'),
    followUp: liffBtn(`/admin/slip/${first.id}`, 'ตรวจสลิปล่าสุด', 'เปิดหน้าตรวจสอบสลิป'),
  }
}

async function managerOccupancy(m: ManagerCtx): Promise<ChatQueryResult> {
  const scope = managerPropertyWhere(m)

  const properties = await prisma.property.findMany({
    where: scope,
    include: { units: true },
  })

  if (!properties.length) {
    return { text: 'ยังไม่มีอาคารในระบบครับ' }
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

  return {
    text: [
      '🏢 สรุปห้องเช่า',
      '',
      ...lines,
      '',
      `รวม: เข้าพัก ${occupied}/${totalUnits} ห้อง (${overallRate}%) · ว่าง ${vacant} ห้อง`,
    ].join('\n'),
    followUp: liffBtn('/admin/portfolio', 'เปิด Dashboard'),
  }
}

function managerHelp(): ChatQueryResult {
  return {
    text: [
      '👔 คำสั่งสำหรับผู้ดูแล/เจ้าของ',
      '',
      '• ขอดู dashboard / สรุปข้อมูล — ภาพรวมทั้งหมด',
      '• สรุปรายรับ / รายได้ — รายรับเดือนนี้',
      '• รายงาน — กราฟ + export',
      '• บิล / ใบแจ้งหนี้ — สถานะบิล',
      '• ค้างชำระ / ใครค้าง — รายการยอดค้าง',
      '• สลิป / รอตรวจ — สลิปรอยืนยัน',
      '• ห้องว่าง / กี่ห้อง — อัตราเข้าพัก',
      '• เปิดระบบ — เปิดแอปจัดการ',
      '',
      'พิมพ์คำถามเป็นภาษาไทยได้เลยครับ',
    ].join('\n'),
    followUp: liffBtn('/admin/portfolio', 'เปิด Dashboard'),
  }
}

/** Try to answer a natural-language question. Returns null if no intent matched. */
export async function tryAnswerChatQuery(
  text: string,
  ctx:
    | { role: 'TENANT'; tenantId: string; unitId: string }
    | { role: 'MANAGER'; manager: ManagerCtx }
): Promise<ChatQueryResult | null> {
  const role = ctx.role === 'TENANT' ? 'TENANT' : 'MANAGER'
  const intent = detectIntent(text, role)
  if (!intent) return null

  switch (intent) {
    case 'TENANT_SUMMARY':
      if (ctx.role !== 'TENANT') return null
      return tenantSummary(ctx.tenantId, ctx.unitId)
    case 'TENANT_CONTRACT':
      if (ctx.role !== 'TENANT') return null
      return tenantContract(ctx.tenantId)
    case 'TENANT_RECEIPTS':
      if (ctx.role !== 'TENANT') return null
      return tenantReceipts(ctx.tenantId)
    case 'TENANT_MAINTENANCE':
      if (ctx.role !== 'TENANT') return null
      return tenantMaintenance(ctx.unitId)
    case 'TENANT_CONTACT':
      if (ctx.role !== 'TENANT') return null
      return tenantContact(ctx.unitId)
    case 'TENANT_PAY':
      if (ctx.role !== 'TENANT') return null
      return tenantPay()
    case 'TENANT_OVERDUE':
      if (ctx.role !== 'TENANT') return null
      return tenantOverdue(ctx.tenantId, ctx.unitId)
    case 'TENANT_BILLS':
      if (ctx.role !== 'TENANT') return null
      return tenantBills(ctx.tenantId, ctx.unitId)
    case 'TENANT_HELP':
      return tenantHelp()
    case 'MANAGER_DASHBOARD':
      if (ctx.role !== 'MANAGER') return null
      return managerDashboard(ctx.manager)
    case 'MANAGER_REVENUE':
      if (ctx.role !== 'MANAGER') return null
      return managerRevenue(ctx.manager)
    case 'MANAGER_REPORTS':
      if (ctx.role !== 'MANAGER') return null
      return managerReports(ctx.manager)
    case 'MANAGER_BILLING':
      if (ctx.role !== 'MANAGER') return null
      return managerBilling(ctx.manager)
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

  const owner = await prisma.owner.findFirst({ where: { lineUserId } })
  if (owner) return { role: 'OWNER', adminId: owner.adminId, ownerId: owner.id, name: owner.name }

  return null
}
