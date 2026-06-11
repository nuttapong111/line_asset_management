import { Message, FlexMessage, QuickReply } from '@line/bot-sdk'
import { lineClient } from './client'
import { isLineConfigured } from '../env'
import {
  buildInvoiceFlex,
  buildReminderFlex,
  buildOverdueFlex,
  buildReceiptFlex,
  buildContractExpiryFlex,
  buildMaintNewFlex,
  buildLinkedFlex,
  buildInviteFlex,
  buildSlipReceivedFlex,
} from './flexMessages'
import {
  InvoiceData,
  ReminderData,
  OverdueData,
  ReceiptData,
  ContractExpiryData,
  MaintData,
  LinkedData,
  InviteData,
  SlipReceivedData,
} from './types/line.types'

async function push(to: string, messages: Message | Message[]): Promise<void> {
  const arr = Array.isArray(messages) ? messages : [messages]
  if (!isLineConfigured || to.startsWith('mock_')) {
    console.log(`[LINE mock] push → ${to}:`, JSON.stringify(arr.map((m) => ('altText' in m ? m.altText : m.type))))
    return
  }
  try {
    await lineClient.pushMessage(to, arr)
  } catch (err) {
    console.error(`[LINE] push failed → ${to}`, err)
  }
}

export async function reply(replyToken: string, messages: Message | Message[]): Promise<void> {
  const arr = Array.isArray(messages) ? messages : [messages]
  if (!isLineConfigured || replyToken.startsWith('mock')) {
    console.log('[LINE mock] reply:', JSON.stringify(arr.map((m) => ('altText' in m ? m.altText : m.type))))
    return
  }
  try {
    await lineClient.replyMessage(replyToken, arr)
  } catch (err) {
    console.error('[LINE] reply failed', err)
  }
}

export const pushInvoice = (to: string, d: InvoiceData) => push(to, buildInvoiceFlex(d))
export const pushRentReminder = (to: string, d: ReminderData) => push(to, buildReminderFlex(d))
export const pushOverdue = (to: string, d: OverdueData) => push(to, buildOverdueFlex(d))
export const pushSlipApproved = (to: string, d: ReceiptData) => push(to, buildReceiptFlex(d))
export const pushSlipReceived = (to: string, d: SlipReceivedData) => push(to, buildSlipReceivedFlex(d))
export const pushContractExpiry = (to: string, d: ContractExpiryData) => push(to, buildContractExpiryFlex(d))
export const pushMaintNew = (to: string, d: MaintData) => push(to, buildMaintNewFlex(d))
export const pushLinked = (to: string, d: LinkedData) => push(to, buildLinkedFlex(d))
export const pushInvite = (to: string, d: InviteData) => push(to, buildInviteFlex(d))

export const pushText = (to: string, text: string) => push(to, { type: 'text', text })

export async function broadcastInvoices(items: { lineUserId: string; data: InvoiceData }[]): Promise<{
  sent: number
  failed: number
}> {
  const results = await Promise.allSettled(items.map((it) => pushInvoice(it.lineUserId, it.data)))
  const sent = results.filter((r) => r.status === 'fulfilled').length
  return { sent, failed: results.length - sent }
}

export function buildQuickMenu(): QuickReply {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: 'ชำระเงิน', text: 'ชำระเงิน' } },
      { type: 'action', action: { type: 'message', label: 'ใบเสร็จล่าสุด', text: 'ใบเสร็จล่าสุด' } },
      { type: 'action', action: { type: 'message', label: 'แจ้งซ่อม', text: 'แจ้งซ่อม' } },
      { type: 'action', action: { type: 'message', label: 'สัญญา', text: 'สัญญา' } },
    ],
  }
}

export async function replyQuickMenu(replyToken: string, text = 'เลือกเมนูที่ต้องการได้เลยครับ'): Promise<void> {
  await reply(replyToken, { type: 'text', text, quickReply: buildQuickMenu() })
}

export function buildFlex(flex: FlexMessage): FlexMessage {
  return flex
}
