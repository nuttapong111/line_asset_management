import { WebhookEvent, MessageEvent, PostbackEvent, FollowEvent } from '@line/bot-sdk'
import { prisma } from '../prisma'
import { liffEntryUrl } from '../env'
import { receiptPdfLiffUrl } from '../../services/paymentService'
import { tryAnswerChatQuery, resolveManagerByLineUserId } from '../../services/chatQueryService'
import { reply, replyQuickMenu, replyChatAnswer, pushText, pushSlipApproved, buildEntryMessage } from './lineService'
import { setTenantRichMenu, setAdminRichMenu } from './richMenu'
import { buildReceiptFlex } from './flexMessages'

const liff = (path: string) => `${liffEntryUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`

export async function handleLineEvents(events: WebhookEvent[]): Promise<void> {
  await Promise.allSettled(events.map(handleEvent))
}

async function handleEvent(event: WebhookEvent): Promise<void> {
  switch (event.type) {
    case 'follow':
      return handleFollow(event)
    case 'unfollow':
      console.log('[LINE] unfollow', event.source.userId)
      return
    case 'message':
      return handleMessage(event)
    case 'postback':
      return handlePostback(event)
    default:
      return
  }
}

async function handleFollow(event: FollowEvent): Promise<void> {
  const userId = event.source.userId
  if (!userId) return

  const tenant = await prisma.tenant.findUnique({ where: { lineUserId: userId }, include: { unit: true } })
  if (tenant) {
    await setTenantRichMenu(userId)
    await reply(event.replyToken, { type: 'text', text: `สวัสดีครับ คุณ${tenant.name} ยินดีต้อนรับ 🏠\nพิมพ์ "สรุปข้อมูล" "ขอดูสัญญาเช่า" หรือ "ช่วยเหลือ"` })
    return
  }

  const admin = await prisma.admin.findUnique({ where: { lineUserId: userId } })
  if (admin) {
    await setAdminRichMenu(userId)
    await reply(event.replyToken, [
      { type: 'text', text: `สวัสดีครับ คุณ${admin.name} 👋\nพิมพ์ "ขอดู dashboard" "สรุปข้อมูล" หรือ "ช่วยเหลือ"` },
      buildEntryMessage('แตะเพื่อเปิดระบบจัดการสำหรับผู้ดูแล', 'เปิดระบบจัดการ'),
    ])
    return
  }

  const owner = await prisma.owner.findFirst({ where: { lineUserId: userId, linkedAt: { not: null } } })
  if (owner) {
    await setAdminRichMenu(userId)
    await reply(event.replyToken, [
      { type: 'text', text: `สวัสดีครับ คุณ${owner.name} 👋\nพิมพ์ "ขอดู dashboard" "สรุปข้อมูล" หรือ "ช่วยเหลือ"` },
      buildEntryMessage('แตะเพื่อเปิดระบบจัดการ', 'เปิดระบบจัดการ'),
    ])
    return
  }

  await reply(event.replyToken, {
    type: 'text',
    text: 'สวัสดีครับ หากคุณเป็นผู้เช่า กรุณากดลิงก์คำเชิญที่ได้รับจากเจ้าของห้องเพื่อผูกบัญชี LINE',
  })
}

async function handleMessage(event: MessageEvent): Promise<void> {
  if (event.message.type !== 'text') return
  const userId = event.source.userId
  const text = event.message.text.trim()

  const [tenant, manager] = await Promise.all([
    userId ? prisma.tenant.findUnique({ where: { lineUserId: userId } }) : null,
    userId ? resolveManagerByLineUserId(userId) : null,
  ])

  switch (text) {
    case 'เข้าระบบ':
    case 'เปิดระบบ':
    case 'เปิดแอป':
    case 'เมนู':
    case 'menu':
    case 'Menu':
      return reply(event.replyToken, buildEntryMessage())
    case 'ใบเสร็จล่าสุด': {
      if (!tenant) return replyQuickMenu(event.replyToken, undefined, manager ? 'MANAGER' : 'TENANT')
      const payment = await prisma.payment.findFirst({
        where: { tenantId: tenant.id, status: 'APPROVED' },
        orderBy: { approvedAt: 'desc' },
        include: { invoice: { include: { unit: true } } },
      })
      if (!payment || !payment.receiptUrl) {
        return reply(event.replyToken, { type: 'text', text: 'ยังไม่มีใบเสร็จล่าสุดครับ' })
      }
      return reply(
        event.replyToken,
        buildReceiptFlex({
          paymentId: payment.id,
          receiptNo: payment.receiptNo || '-',
          roomNumber: payment.invoice.unit.roomNumber,
          tenantName: tenant.name,
          amount: Number(payment.invoice.total),
          date: payment.approvedAt?.toLocaleDateString('th-TH') || '-',
          receiptUrl: receiptPdfLiffUrl(payment.id),
          historyUrl: liff('/receipt'),
        })
      )
    }
    case 'ชำระเงิน':
    case 'จ่ายค่าเช่า':
      return reply(event.replyToken, { type: 'text', text: `เปิดหน้าชำระเงิน: ${liff('/payment')}` })
    case 'แจ้งซ่อม':
      return reply(event.replyToken, { type: 'text', text: `แจ้งซ่อมได้ที่: ${liff('/maintenance/new')}` })
    case 'สัญญา':
    case 'ขอดูสัญญาเช่า':
    case 'ดูสัญญา': {
      if (tenant) {
        const answer = await tryAnswerChatQuery(text, {
          role: 'TENANT',
          tenantId: tenant.id,
          unitId: tenant.unitId,
        })
        if (answer) return replyChatAnswer(event.replyToken, answer, 'TENANT')
      }
      return reply(event.replyToken, { type: 'text', text: `ดูสัญญาได้ที่: ${liff('/contract')}` })
    }
    case 'สรุปข้อมูล':
    case 'ขอดู dashboard':
    case 'Dashboard':
    case 'dashboard': {
      if (tenant) {
        const answer = await tryAnswerChatQuery(text, {
          role: 'TENANT',
          tenantId: tenant.id,
          unitId: tenant.unitId,
        })
        if (answer) return replyChatAnswer(event.replyToken, answer, 'TENANT')
      }
      if (manager) {
        const answer = await tryAnswerChatQuery(text, { role: 'MANAGER', manager })
        if (answer) return replyChatAnswer(event.replyToken, answer, 'MANAGER')
      }
      return reply(event.replyToken, buildEntryMessage())
    }
    default: {
      // Natural-language queries (tenant or manager)
      if (tenant) {
        const answer = await tryAnswerChatQuery(text, {
          role: 'TENANT',
          tenantId: tenant.id,
          unitId: tenant.unitId,
        })
        if (answer) {
          return replyChatAnswer(event.replyToken, answer, 'TENANT')
        }
      }

      if (manager) {
        const answer = await tryAnswerChatQuery(text, { role: 'MANAGER', manager })
        if (answer) {
          return replyChatAnswer(event.replyToken, answer, 'MANAGER')
        }
        return replyQuickMenu(
          event.replyToken,
          'ไม่เข้าใจคำถามครับ ลองพิมพ์ "ขอดู dashboard" "สรุปข้อมูล" หรือ "ช่วยเหลือ"',
          'MANAGER'
        )
      }

      if (tenant) {
        await prisma.chatMessage.create({
          data: { tenantId: tenant.id, senderRole: 'TENANT', message: text },
        })
        const unit = await prisma.unit.findUnique({
          where: { id: tenant.unitId },
          include: { property: { include: { admin: true, owner: true } } },
        })
        const notifyMsg = `💬 ข้อความจาก ${tenant.name} (ห้อง ${unit?.roomNumber}): ${text}`
        if (unit?.property.owner?.lineUserId) {
          await pushText(unit.property.owner.lineUserId, notifyMsg)
        } else if (unit?.property.admin.lineUserId) {
          await pushText(unit.property.admin.lineUserId, notifyMsg)
        }
        return replyQuickMenu(
          event.replyToken,
          'ส่งข้อความถึงเจ้าของแล้วครับ ลองพิมพ์ "ค้างชำระ" หรือ "ช่วยเหลือ" เพื่อดูข้อมูลได้ทันที',
          'TENANT'
        )
      }

      return replyQuickMenu(event.replyToken)
    }
  }
}

async function handlePostback(event: PostbackEvent): Promise<void> {
  let data: { action?: string; paymentId?: string; ticketId?: string } = {}
  try {
    data = JSON.parse(event.postback.data)
  } catch {
    return
  }

  // Lazy import to avoid circular dependency
  const { approvePayment, rejectPayment } = await import('../../services/paymentService')

  switch (data.action) {
    case 'APPROVE_PAYMENT':
      if (data.paymentId) await approvePayment(data.paymentId)
      await reply(event.replyToken, { type: 'text', text: 'อนุมัติการชำระเงินแล้ว และส่งใบเสร็จให้ผู้เช่าเรียบร้อย ✅' })
      return
    case 'REJECT_PAYMENT':
      if (data.paymentId) await rejectPayment(data.paymentId, 'ปฏิเสธจาก LINE')
      await reply(event.replyToken, { type: 'text', text: 'ปฏิเสธสลิปแล้ว' })
      return
    case 'ACK_MAINTENANCE':
      if (data.ticketId) {
        await prisma.maintenance.update({ where: { id: data.ticketId }, data: { status: 'ACKNOWLEDGED' } })
      }
      await reply(event.replyToken, { type: 'text', text: 'รับเรื่องแจ้งซ่อมแล้ว' })
      return
    default:
      return
  }
}
