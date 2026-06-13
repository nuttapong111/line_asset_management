import { prisma } from '../lib/prisma'
import { env } from '../lib/env'
import { pushText } from '../lib/line/lineService'

const liff = (path: string) => `${env.LIFF_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`

/** Send a plain-text LINE message to the linked owner (manager) of a property. */
export async function notifyOwnersOfProperty(propertyId: string, message: string): Promise<void> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owner: true },
  })
  const owner = property?.owner
  if (owner?.lineUserId && owner.linkedAt) {
    await pushText(owner.lineUserId, message)
  }
}

export async function notifyOwnersPayment(opts: {
  propertyId: string
  roomNumber: string
  tenantName: string
  amount: number
  kind: 'slip' | 'approved'
}): Promise<void> {
  const baht = '฿' + opts.amount.toLocaleString('th-TH')
  const head = opts.kind === 'slip' ? '💰 มีการแจ้งชำระเงินใหม่' : '✅ ยืนยันการชำระเงินแล้ว'
  const msg = `${head}\nห้อง ${opts.roomNumber} · ${opts.tenantName}\nยอด ${baht}\nตรวจสอบ: ${liff('/admin/billing')}`
  await notifyOwnersOfProperty(opts.propertyId, msg)
}

export async function notifyOwnersMaintenance(opts: {
  propertyId: string
  ticketNo: string
  roomNumber: string
  title: string
}): Promise<void> {
  const msg = `🔧 มีรายการแจ้งซ่อมใหม่\n${opts.ticketNo} · ห้อง ${opts.roomNumber}\n"${opts.title}"\nตรวจสอบ: ${liff('/admin/portfolio')}`
  await notifyOwnersOfProperty(opts.propertyId, msg)
}
