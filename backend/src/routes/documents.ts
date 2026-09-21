import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authMiddleware, requireRole } from '../middleware/auth'

const router = Router()
router.use(authMiddleware, requireRole('TENANT'))

router.get('/', async (req, res) => {
  const unitId = req.user!.unitId
  if (!unitId) return res.json([])

  const [invoices, contract] = await Promise.all([
    prisma.invoice.findMany({
      where: { unitId },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.contract.findFirst({
      where: { unitId, status: { in: ['ACTIVE', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const items: {
    kind: 'invoice' | 'receipt' | 'contract'
    id: string
    title: string
    subtitle: string
    date: string
    status: string
    statusKind: 'paid' | 'pending' | 'overdue' | 'info' | 'gray'
    href: string
    unpaid?: boolean
  }[] = []

  for (const inv of invoices) {
    const monthLabel = `${inv.month}/${inv.year}`
    const typeLabel = inv.type === 'UTILITY' ? 'บิลค่าน้ำค่าไฟ' : 'ใบแจ้งหนี้ค่าเช่า'
    items.push({
      kind: 'invoice',
      id: inv.id,
      title: `${typeLabel} ${monthLabel}`,
      subtitle: `ยอด ${Number(inv.total).toLocaleString('th-TH')} บาท`,
      date: inv.dueDate.toISOString(),
      status:
        inv.status === 'PAID'
          ? 'ชำระแล้ว'
          : inv.status === 'OVERDUE'
          ? 'ค้างชำระ'
          : inv.status === 'SLIP_UPLOADED'
          ? 'รอตรวจสลิป'
          : 'รอชำระ',
      statusKind:
        inv.status === 'PAID'
          ? 'paid'
          : inv.status === 'OVERDUE'
          ? 'overdue'
          : inv.status === 'SLIP_UPLOADED'
          ? 'info'
          : 'pending',
      href: `/tenant/invoice/${inv.id}`,
      unpaid: ['PENDING', 'OVERDUE'].includes(inv.status),
    })
    if (inv.status === 'PAID' && inv.payment?.id) {
      items.push({
        kind: 'receipt',
        id: inv.payment.id,
        title: inv.payment.receiptNo ? `ใบเสร็จ ${inv.payment.receiptNo}` : `ใบเสร็จ ${monthLabel}`,
        subtitle: `ยอด ${Number(inv.total).toLocaleString('th-TH')} บาท`,
        date: (inv.payment.approvedAt || inv.payment.createdAt).toISOString(),
        status: 'ใบเสร็จ',
        statusKind: 'paid',
        href: `receipt-pdf:${inv.payment.id}`,
      })
    }
  }

  if (contract) {
    items.push({
      kind: 'contract',
      id: contract.id,
      title: 'สัญญาเช่า',
      subtitle: contract.status === 'ACTIVE' ? 'ใช้งานอยู่' : contract.status,
      date: contract.endDate.toISOString(),
      status: contract.status === 'ACTIVE' ? 'ใช้งานอยู่' : contract.status,
      statusKind: contract.status === 'ACTIVE' ? 'info' : 'gray',
      href: `/contract/${contract.id}`,
      unpaid: false,
    })
  }

  items.sort((a, b) => {
    if (a.unpaid && !b.unpaid) return -1
    if (!a.unpaid && b.unpaid) return 1
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  res.json(items)
})

export default router
