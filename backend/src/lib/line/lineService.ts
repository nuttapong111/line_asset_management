import { Message, FlexMessage, QuickReply, TemplateMessage } from '@line/bot-sdk'
import { lineClient } from './client'
import { isLineConfigured, liffEntryUrl } from '../env'
import { buildLiffPathMessage as buildLiffPathMessageHelper } from './liffHelpers'
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
  buildSubscriptionReminderFlex,
  buildSubscriptionSlipReceivedFlex,
  buildSubscriptionResultFlex,
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
  SubscriptionReminderData,
  SubscriptionSlipReceivedData,
  SubscriptionResultData,
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
    console.error('[LINE] reply failed', err, JSON.stringify(arr.map((m) => m.type)))
    throw err
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
export const pushSubscriptionReminder = (to: string, d: SubscriptionReminderData) =>
  push(to, buildSubscriptionReminderFlex(d))
export const pushSubscriptionSlipReceived = (to: string, d: SubscriptionSlipReceivedData) =>
  push(to, buildSubscriptionSlipReceivedFlex(d))
export const pushSubscriptionResult = (to: string, d: SubscriptionResultData) =>
  push(to, buildSubscriptionResultFlex(d))

export const pushText = (to: string, text: string) => push(to, { type: 'text', text })

/**
 * A "open the app" button card. Tapping it opens the LIFF entry URL which
 * role-routes the user (admin → portfolio, owner → dashboard, tenant → home).
 */
export function buildEntryMessage(text = 'แตะปุ่มด้านล่างเพื่อเปิดระบบ PropFlow', label = 'เปิดระบบ'): TemplateMessage {
  return {
    type: 'template',
    altText: 'เปิดระบบ PropFlow',
    template: {
      type: 'buttons',
      title: 'PropFlow',
      text: text.slice(0, 60),
      actions: [{ type: 'uri', label: label.slice(0, 20), uri: liffEntryUrl }],
    },
  }
}

export const buildLiffPathMessage = buildLiffPathMessageHelper

export async function replyChatAnswer(
  replyToken: string,
  result: { text: string; followUp?: TemplateMessage },
  role: 'TENANT' | 'MANAGER' = 'TENANT'
): Promise<void> {
  const quickReply = role === 'MANAGER' ? buildManagerQuickMenu() : buildQuickMenu()
  const text = result.text.slice(0, 4900)
  try {
    await reply(replyToken, { type: 'text', text, quickReply })
  } catch {
    // Retry without quickReply if LINE rejects the combo
    await reply(replyToken, { type: 'text', text })
  }
}

export const pushEntry = (to: string, text?: string, label?: string) =>
  push(to, buildEntryMessage(text, label))

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
      { type: 'action', action: { type: 'message', label: 'สรุปข้อมูล', text: 'สรุปข้อมูล' } },
      { type: 'action', action: { type: 'message', label: 'สัญญาเช่า', text: 'ขอดูสัญญาเช่า' } },
      { type: 'action', action: { type: 'message', label: 'ยอดค้าง', text: 'ค้างชำระกี่ยอด' } },
      { type: 'action', action: { type: 'message', label: 'ชำระเงิน', text: 'ชำระเงิน' } },
    ],
  }
}

export function buildManagerQuickMenu(): QuickReply {
  return {
    items: [
      { type: 'action', action: { type: 'message', label: 'Dashboard', text: 'ขอดู dashboard' } },
      { type: 'action', action: { type: 'message', label: 'สรุปข้อมูล', text: 'สรุปข้อมูล' } },
      { type: 'action', action: { type: 'message', label: 'ค้างชำระ', text: 'ยอดค้างชำระ' } },
      { type: 'action', action: { type: 'message', label: 'สลิปรอตรวจ', text: 'สลิปรอตรวจ' } },
    ],
  }
}

export async function replyQuickMenu(
  replyToken: string,
  text = 'เลือกเมนูที่ต้องการได้เลยครับ',
  role: 'TENANT' | 'MANAGER' = 'TENANT'
): Promise<void> {
  const quickReply = role === 'MANAGER' ? buildManagerQuickMenu() : buildQuickMenu()
  await reply(replyToken, { type: 'text', text, quickReply })
}

export function buildFlex(flex: FlexMessage): FlexMessage {
  return flex
}
