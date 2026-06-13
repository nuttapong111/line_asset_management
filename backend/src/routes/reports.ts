import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'
import { propertyWhere } from '../lib/scope'

const router = Router()
router.use(authMiddleware, requireRole('ADMIN', 'OWNER'))

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
        const amt = Number(inv.total)
        total += amt
        revenue += amt
        if (inv.status === 'PAID') collected += amt
        else if (inv.status === 'OVERDUE') overdue += amt
        else pending += amt
      }
    }
    return {
      propertyId: p.id,
      name: p.name,
      revenue,
      occupancyRate: totalUnits ? Math.round((occupied / totalUnits) * 100) : 0,
    }
  })

  // byMonth: last 6 months
  const now = new Date()
  const byMonth: { month: number; year: number; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    const invs = await prisma.invoice.findMany({
      where: { month: m, year: y, status: 'PAID', unit: { property: scope } },
    })
    byMonth.push({ month: m, year: y, revenue: invs.reduce((a, i) => a + Number(i.total), 0) })
  }

  res.json({
    summary: { total, collected, pending, overdue },
    byProperty,
    byMonth,
    year,
  })
})

// GET /api/reports/export?format=csv
router.get('/export', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { unit: { property: propertyWhere(req.user!) } },
    include: { unit: { include: { property: true, tenants: { where: { isActive: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  const header = 'Property,Room,Tenant,Month,Year,Total,Status,DueDate\n'
  const rows = invoices
    .map((i) => {
      const tenant = i.unit.tenants[0]?.name || '-'
      return [
        i.unit.property.name,
        i.unit.roomNumber,
        tenant,
        i.month,
        i.year,
        Number(i.total),
        i.status,
        i.dueDate.toISOString().slice(0, 10),
      ].join(',')
    })
    .join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"')
  res.send('\uFEFF' + header + rows)
})

export default router
