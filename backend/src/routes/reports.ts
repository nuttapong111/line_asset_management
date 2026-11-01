import { Router } from 'express'
import ExcelJS from 'exceljs'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'))

function parseYearMonth(q: { year?: string; month?: string }) {
  const now = new Date()
  const year = q.year ? parseInt(q.year, 10) : now.getFullYear()
  const month = q.month ? parseInt(q.month, 10) : undefined
  return { year, month }
}

type Scope = ReturnType<typeof propertyWhere>

async function ownerTasks(scope: Scope, now: Date) {
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const in60 = new Date(now)
  in60.setDate(in60.getDate() + 60)

  const [slips, tickets, meters, contracts, moveOuts] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'UNDER_REVIEW', invoice: { unit: { property: scope } } },
      include: { invoice: { include: { unit: true } }, tenant: true },
      orderBy: { slipUploadedAt: 'desc' },
      take: 20,
    }),
    prisma.maintenance.findMany({
      where: { status: 'NEW', unit: { property: scope } },
      include: { unit: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.unit.findMany({
      where: { status: 'OCCUPIED', property: scope },
      include: { meterReadings: { where: { month, year }, take: 1 }, property: true },
    }),
    prisma.contract.findMany({
      where: { status: 'ACTIVE', endDate: { gte: now, lte: in60 }, unit: { property: scope } },
      include: { unit: true, tenant: true },
      orderBy: { endDate: 'asc' },
      take: 8,
    }),
    prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        moveOutRequestedAt: { not: null },
        moveOut: null,
        unit: { property: scope },
      },
      include: { unit: true, tenant: true },
      orderBy: { moveOutRequestedAt: 'desc' },
      take: 8,
    }),
  ])

  const seenBundle = new Set<string>()
  const tasks: { kind: string; id: string; title: string; meta: string; href: string }[] = []
  for (const p of slips) {
    if (p.bundleId) {
      if (seenBundle.has(p.bundleId)) continue
      seenBundle.add(p.bundleId)
    }
    tasks.push({
      kind: 'slip',
      id: p.id,
      title: `ตรวจสลิป ห้อง ${p.invoice.unit.roomNumber}`,
      meta: p.tenant.name,
      href: `/admin/slip/${p.id}`,
    })
  }
  for (const t of tickets) {
    tasks.push({
      kind: 'ticket',
      id: t.id,
      title: `แจ้งซ่อม ${t.ticketNo}`,
      meta: `${t.unit.roomNumber} · ${t.title}`,
      href: `/admin/maintenance/${t.id}`,
    })
  }
  for (const u of meters) {
    if (u.meterReadings.length > 0) continue
    tasks.push({
      kind: 'meter',
      id: u.id,
      title: `จดมิเตอร์ ห้อง ${u.roomNumber}`,
      meta: u.property.name,
      href: `/admin/property/${u.propertyId}/meter`,
    })
  }
  for (const c of moveOuts) {
    tasks.push({
      kind: 'moveout',
      id: c.id,
      title: `แจ้งย้ายออก ห้อง ${c.unit.roomNumber}`,
      meta: c.tenant.name,
      href: `/admin/contract/${c.id}/move-out`,
    })
  }
  for (const c of contracts) {
    const days = Math.ceil((c.endDate.getTime() - now.getTime()) / 86400000)
    tasks.push({
      kind: 'contract',
      id: c.id,
      title: `สัญญาใกล้หมด ห้อง ${c.unit.roomNumber}`,
      meta: `อีก ${days} วัน · ${c.tenant.name}`,
      href: `/admin/contract/${c.id}`,
    })
  }
  return tasks
}

// GET /api/reports/dashboard — summary cards for portal
router.get('/dashboard', async (req, res) => {
  const scope = propertyWhere(req.user!)
  const properties = await prisma.property.findMany({
    where: scope,
    include: {
      units: {
        include: {
          invoices: true,
          tenants: { where: { isActive: true }, include: { contracts: { where: { status: 'ACTIVE' } } } },
        },
      },
    },
  })

  let total = 0
  let collected = 0
  let pending = 0
  let overdue = 0
  let totalUnits = 0
  let occupied = 0

  for (const p of properties) {
    totalUnits += p.units.length
    occupied += p.units.filter((u) => u.status === 'OCCUPIED').length
    for (const u of p.units) {
      for (const inv of u.invoices) {
        const amt = Number(inv.total)
        total += amt
        if (inv.status === 'PAID') collected += amt
        else if (inv.status === 'OVERDUE') overdue += amt
        else if (inv.status !== 'CANCELLED') pending += amt
      }
    }
  }

  const pendingSlips = await prisma.payment.count({
    where: {
      status: 'UNDER_REVIEW',
      invoice: { unit: { property: scope } },
    },
  })

  const unackedMaintenance = await prisma.maintenance.count({
    where: { status: 'NEW', unit: { property: scope } },
  })

  const renewalRequests = await prisma.contract.count({
    where: {
      status: 'ACTIVE',
      renewalRequestedAt: { not: null },
      unit: { property: scope },
    },
  })

  const in30 = new Date()
  in30.setDate(in30.getDate() + 30)
  const in60 = new Date()
  in60.setDate(in60.getDate() + 60)
  const now = new Date()

  const contractsExpiring30 = await prisma.contract.count({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: in30 },
      unit: { property: scope },
    },
  })
  const contractsExpiring60 = await prisma.contract.count({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: in60 },
      unit: { property: scope },
    },
  })

  const recentSlips = await prisma.payment.findMany({
    where: { status: 'UNDER_REVIEW', invoice: { unit: { property: scope } } },
    include: {
      invoice: { include: { unit: { include: { property: true } } } },
      tenant: true,
    },
    orderBy: { slipUploadedAt: 'desc' },
    take: 8,
  })

  const expiringContracts = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now, lte: in60 },
      unit: { property: scope },
    },
    include: { tenant: true, unit: { include: { property: true } } },
    orderBy: { endDate: 'asc' },
    take: 8,
  })

  const overdueInvoices = await prisma.invoice.findMany({
    where: { status: 'OVERDUE', unit: { property: scope } },
    include: { unit: { include: { property: true, tenants: { where: { isActive: true } } } } },
    orderBy: { dueDate: 'asc' },
    take: 8,
  })

  const newTickets = await prisma.maintenance.findMany({
    where: { status: 'NEW', unit: { property: scope } },
    include: { unit: { include: { property: true } } },
    orderBy: { createdAt: 'desc' },
    take: 8,
  })

  const pendingRenewals = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      renewalRequestedAt: { not: null },
      unit: { property: scope },
    },
    include: { tenant: true, unit: { include: { property: true } } },
    orderBy: { renewalRequestedAt: 'desc' },
    take: 8,
  })

  res.json({
    summary: {
      total,
      collected,
      pending,
      overdue,
      occupancyRate: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
      totalUnits,
      occupiedUnits: occupied,
      propertyCount: properties.length,
      pendingSlips,
      contractsExpiring30,
      contractsExpiring60,
      unackedMaintenance,
      renewalRequests,
    },
    recentSlips: recentSlips.map((p) => ({
      id: p.id,
      amount: Number(p.invoice.total),
      roomNumber: p.invoice.unit.roomNumber,
      propertyName: p.invoice.unit.property.name,
      tenantName: p.tenant.name,
      slipUploadedAt: p.slipUploadedAt,
    })),
    expiringContracts: expiringContracts.map((c) => ({
      id: c.id,
      roomNumber: c.unit.roomNumber,
      propertyName: c.unit.property.name,
      tenantName: c.tenant.name,
      endDate: c.endDate,
      renewalRequestedAt: c.renewalRequestedAt,
    })),
    overdueInvoices: overdueInvoices.map((i) => ({
      id: i.id,
      roomNumber: i.unit.roomNumber,
      propertyName: i.unit.property.name,
      tenantName: i.unit.tenants[0]?.name || '-',
      total: Number(i.total),
      dueDate: i.dueDate,
    })),
    newTickets: newTickets.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      roomNumber: t.unit.roomNumber,
      propertyName: t.unit.property.name,
      createdAt: t.createdAt,
    })),
    pendingRenewals: pendingRenewals.map((c) => ({
      id: c.id,
      roomNumber: c.unit.roomNumber,
      propertyName: c.unit.property.name,
      tenantName: c.tenant.name,
      endDate: c.endDate,
      renewalRequestedAt: c.renewalRequestedAt,
      renewalNote: c.renewalNote,
    })),
    tasks: await ownerTasks(scope, now),
  })
})

// GET /api/reports/revenue
router.get('/revenue', async (req, res) => {
  const scope = propertyWhere(req.user!)
  const propertyId = req.query.propertyId as string | undefined
  const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear()

  const propWhere = propertyId ? { id: propertyId, ...scope } : scope
  const properties = await prisma.property.findMany({
    where: propWhere,
    include: { units: { include: { invoices: true } } },
  })

  let total = 0
  let collected = 0
  let pending = 0
  let overdue = 0

  const byProperty = properties.map((p) => {
    let revenue = 0
    const totalUnits = p.units.length
    const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length
    for (const u of p.units) {
      for (const inv of u.invoices) {
        if (inv.year !== year) continue
        const amt = Number(inv.total)
        total += amt
        revenue += amt
        if (inv.status === 'PAID') collected += amt
        else if (inv.status === 'OVERDUE') overdue += amt
        else if (inv.status !== 'CANCELLED') pending += amt
      }
    }
    return {
      propertyId: p.id,
      name: p.name,
      revenue,
      occupancyRate: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
    }
  })

  const byMonth: { month: number; year: number; revenue: number; pending: number; overdue: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const invs = await prisma.invoice.findMany({
      where: {
        month: m,
        year,
        status: { not: 'CANCELLED' },
        unit: { property: propWhere },
      },
    })
    byMonth.push({
      month: m,
      year,
      revenue: invs.filter((i) => i.status === 'PAID').reduce((a, i) => a + Number(i.total), 0),
      pending: invs
        .filter((i) => i.status === 'PENDING' || i.status === 'SLIP_UPLOADED')
        .reduce((a, i) => a + Number(i.total), 0),
      overdue: invs.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + Number(i.total), 0),
    })
  }

  res.json({
    summary: { total, collected, pending, overdue },
    byProperty,
    byMonth,
    year,
    propertyId: propertyId || null,
  })
})

// GET /api/reports/export?format=csv|xlsx&propertyId=&year=&month=
router.get('/export', async (req, res) => {
  const scope = propertyWhere(req.user!)
  const propertyId = req.query.propertyId as string | undefined
  const format = ((req.query.format as string) || 'csv').toLowerCase()
  const { year, month } = parseYearMonth({
    year: req.query.year as string | undefined,
    month: req.query.month as string | undefined,
  })

  const invoices = await prisma.invoice.findMany({
    where: {
      unit: { property: propertyId ? { id: propertyId, ...scope } : scope },
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
    },
    include: { unit: { include: { property: true, tenants: { where: { isActive: true } } } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })

  const rows = invoices.map((i) => ({
    property: i.unit.property.name,
    room: i.unit.roomNumber,
    tenant: i.unit.tenants[0]?.name || '-',
    month: i.month,
    year: i.year,
    total: Number(i.total),
    status: i.status,
    dueDate: i.dueDate.toISOString().slice(0, 10),
  }))

  if (format === 'xlsx' || format === 'excel') {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Invoices')
    ws.columns = [
      { header: 'Property', key: 'property', width: 24 },
      { header: 'Room', key: 'room', width: 10 },
      { header: 'Tenant', key: 'tenant', width: 18 },
      { header: 'Month', key: 'month', width: 8 },
      { header: 'Year', key: 'year', width: 8 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'DueDate', key: 'dueDate', width: 12 },
    ]
    ws.addRows(rows)
    ws.getRow(1).font = { bold: true }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"')
    await wb.xlsx.write(res)
    res.end()
    return
  }

  const header = 'Property,Room,Tenant,Month,Year,Total,Status,DueDate\n'
  const csv = rows
    .map((r) => [r.property, r.room, r.tenant, r.month, r.year, r.total, r.status, r.dueDate].join(','))
    .join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"')
  res.send('\uFEFF' + header + csv)
})

export default router
