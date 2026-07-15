import { FlexMessage, FlexComponent, FlexBox } from '@line/bot-sdk'
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

const COLORS = {
  green: '#06C755',
  greenDark: '#04A244',
  amber: '#EF9F27',
  red: '#E24B4A',
  blue: '#185FA5',
  gray: '#888780',
  text: '#333333',
  muted: '#888888',
}

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function baht(n: number): string {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function row(label: string, value: string, valueColor = COLORS.text, bold = false): FlexComponent {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLORS.muted, flex: 0 },
      {
        type: 'text',
        text: value,
        size: 'sm',
        color: valueColor,
        align: 'end',
        weight: bold ? 'bold' : 'regular',
      },
    ],
  }
}

function header(title: string, subtitle: string, color: string): FlexBox {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: color,
    paddingAll: '16px',
    contents: [
      { type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'lg' },
      { type: 'text', text: subtitle, color: '#FFFFFFCC', size: 'sm', margin: 'sm' },
    ],
  }
}

function separator(): FlexComponent {
  return { type: 'separator', margin: 'md' }
}

export function buildInvoiceFlex(d: InvoiceData): FlexMessage {
  const headerTitle = d.title || 'ใบแจ้งหนี้ค่าเช่า'
  const itemRows: FlexComponent[] = d.items.map((it) => row(it.label, baht(it.amount)))
  return {
    type: 'flex',
    altText: `${headerTitle} ${THAI_MONTHS[d.month]} ${d.year} ห้อง ${d.roomNumber} ${baht(d.total)}`,
    contents: {
      type: 'bubble',
      header: header(headerTitle, `${THAI_MONTHS[d.month]} ${d.year}`, COLORS.green),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('ผู้เช่า', d.tenantName),
          separator(),
          ...itemRows,
          separator(),
          row('รวมทั้งสิ้น', baht(d.total), COLORS.green, true),
          row('กำหนดชำระ', d.dueDate, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: { type: 'uri', label: 'ชำระเงิน', uri: d.liffUrl },
          },
        ],
      },
    },
  }
}

export function buildReminderFlex(d: ReminderData): FlexMessage {
  return {
    type: 'flex',
    altText: `เตือนชำระค่าเช่า ครบกำหนดใน ${d.daysLeft} วัน ห้อง ${d.roomNumber}`,
    contents: {
      type: 'bubble',
      header: header('เตือนชำระค่าเช่า', `ครบกำหนดใน ${d.daysLeft} วัน`, COLORS.amber),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('ยอดชำระ', baht(d.amount), COLORS.amber, true),
          row('กำหนดชำระ', d.dueDate, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.amber,
            action: { type: 'uri', label: 'ชำระเงินตอนนี้', uri: d.liffUrl },
          },
        ],
      },
    },
  }
}

export function buildOverdueFlex(d: OverdueData): FlexMessage {
  return {
    type: 'flex',
    altText: `ค้างชำระ ${d.daysOverdue} วัน ห้อง ${d.roomNumber} รวม ${baht(d.total)}`,
    contents: {
      type: 'bubble',
      header: header('ค้างชำระค่าเช่า', `ค้างชำระ ${d.daysOverdue} วัน`, COLORS.red),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('ยอดค้าง', baht(d.originalAmount)),
          row('ค่าปรับ', baht(d.lateFee), COLORS.red),
          separator(),
          row('รวมทั้งสิ้น', baht(d.total), COLORS.red, true),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.red,
            action: { type: 'uri', label: 'ชำระด่วน', uri: d.liffUrl },
          },
        ],
      },
    },
  }
}

export function buildReceiptFlex(d: ReceiptData): FlexMessage {
  const footerButtons: FlexComponent[] = [
    {
      type: 'button',
      style: 'primary',
      color: COLORS.green,
      action: { type: 'uri', label: 'ดาวน์โหลดใบเสร็จ', uri: d.receiptUrl },
    },
  ]
  if (d.historyUrl) {
    footerButtons.push({
      type: 'button',
      style: 'secondary',
      action: { type: 'uri', label: 'ประวัติการชำระ', uri: d.historyUrl },
    })
  }

  return {
    type: 'flex',
    altText: `อนุมัติการชำระแล้ว ${baht(d.amount)} ใบเสร็จ ${d.receiptNo}`,
    contents: {
      type: 'bubble',
      header: header('ชำระเงินสำเร็จ ✓', 'เจ้าของอนุมัติแล้ว — ดาวน์โหลดใบเสร็จได้', COLORS.green),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('เลขใบเสร็จ', d.receiptNo),
          row('ห้อง', d.roomNumber),
          row('ผู้เช่า', d.tenantName),
          row('ยอดชำระ', baht(d.amount), COLORS.green, true),
          row('วันที่', d.date, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: footerButtons,
      },
    },
  }
}

export function buildContractExpiryFlex(d: ContractExpiryData): FlexMessage {
  return {
    type: 'flex',
    altText: `สัญญาใกล้หมด อีก ${d.daysLeft} วัน ห้อง ${d.roomNumber}`,
    contents: {
      type: 'bubble',
      header: header('สัญญาใกล้หมดอายุ', `อีก ${d.daysLeft} วัน`, COLORS.blue),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('ผู้เช่า', d.tenantName),
          row('สิ้นสุดสัญญา', d.endDate, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.blue,
            action: { type: 'uri', label: 'ต่อสัญญา', uri: d.renewUrl },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: 'ดูสัญญา', uri: d.viewUrl },
          },
        ],
      },
    },
  }
}

export function buildMaintNewFlex(d: MaintData): FlexMessage {
  return {
    type: 'flex',
    altText: `แจ้งซ่อมใหม่ ${d.title} ห้อง ${d.roomNumber}`,
    contents: {
      type: 'bubble',
      header: header('แจ้งซ่อมใหม่', d.title, COLORS.gray),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('Ticket', d.ticketNo),
          row('ห้อง', d.roomNumber),
          row('ผู้เช่า', d.tenantName),
          row('ประเภท', d.category),
          row('เวลา', d.createdAt, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: {
              type: 'postback',
              label: 'รับเรื่อง',
              data: JSON.stringify({ action: 'ACK_MAINTENANCE', ticketId: d.ticketId }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: 'ดู ticket', uri: d.viewUrl },
          },
        ],
      },
    },
  }
}

export function buildSlipReceivedFlex(d: SlipReceivedData): FlexMessage {
  return {
    type: 'flex',
    altText: `มีสลิปใหม่ ห้อง ${d.roomNumber} ${baht(d.amount)}`,
    contents: {
      type: 'bubble',
      header: header('มีสลิปชำระเงินใหม่', `ห้อง ${d.roomNumber}`, COLORS.green),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ผู้เช่า', d.tenantName),
          row('ยอดโอน', baht(d.amount), COLORS.green, true),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: {
              type: 'postback',
              label: 'อนุมัติ',
              data: JSON.stringify({ action: 'APPROVE_PAYMENT', paymentId: d.paymentId }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: 'ดูสลิป', uri: d.reviewUrl },
          },
        ],
      },
    },
  }
}

export function buildLinkedFlex(d: LinkedData): FlexMessage {
  return {
    type: 'flex',
    altText: `${d.tenantName} ผูก LINE สำเร็จ ห้อง ${d.roomNumber}`,
    contents: {
      type: 'bubble',
      header: header('ผูก LINE สำเร็จ', d.tenantName, COLORS.green),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('เวลา', d.linkedAt, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: { type: 'uri', label: 'ดูโปรไฟล์ผู้เช่า', uri: d.profileUrl },
          },
        ],
      },
    },
  }
}

export function buildInviteFlex(d: InviteData): FlexMessage {
  return {
    type: 'flex',
    altText: `คำเชิญเป็นผู้เช่า ${d.propertyName} ห้อง ${d.roomNumber}`,
    contents: {
      type: 'bubble',
      header: header('คำเชิญเป็นผู้เช่า', d.propertyName, COLORS.green),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ห้อง', d.roomNumber),
          row('ค่าเช่า', baht(d.rentAmount), COLORS.green, true),
          row('เริ่มเช่า', d.startDate, COLORS.muted),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: { type: 'uri', label: 'ยืนยันและผูก LINE', uri: d.inviteUrl },
          },
        ],
      },
    },
  }
}

export function buildSubscriptionReminderFlex(d: SubscriptionReminderData): FlexMessage {
  const overdue = d.daysLeft < 0 || d.status === 'GRACE'
  const title = overdue ? 'ค่าบริการเลยกำหนด' : 'ค่าบริการใกล้หมดอายุ'
  const subtitle =
    d.daysLeft > 0 ? `เหลือ ${d.daysLeft} วัน` : d.daysLeft === 0 ? 'หมดอายุวันนี้' : 'อยู่ในระยะผ่อนผัน'
  return {
    type: 'flex',
    altText: `${title} — ${baht(d.amount)}`,
    contents: {
      type: 'bubble',
      header: header(title, d.ownerName, overdue ? COLORS.red : COLORS.amber),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('หมดอายุ', d.expiresAt),
          row('เลขที่บิล', d.billNo),
          row('ยอดชำระ', baht(d.amount), COLORS.green, true),
          separator(),
          {
            type: 'text',
            text: 'ชำระผ่าน PromptPay ของ PropFlow แล้วแนบสลิปในระบบ',
            size: 'xs',
            color: COLORS.muted,
            wrap: true,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: { type: 'uri', label: 'ชำระค่าบริการ', uri: d.payUrl },
          },
        ],
      },
    },
  }
}

export function buildSubscriptionSlipReceivedFlex(d: SubscriptionSlipReceivedData): FlexMessage {
  return {
    type: 'flex',
    altText: `สลิปค่าบริการ ${d.ownerName} ${baht(d.amount)}`,
    contents: {
      type: 'bubble',
      header: header('สลิปค่าบริการใหม่', d.billNo, COLORS.blue),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('เจ้าของ', d.ownerName),
          row('ยอด', baht(d.amount), COLORS.green, true),
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: COLORS.green,
            action: {
              type: 'postback',
              label: 'อนุมัติ',
              data: JSON.stringify({ action: 'APPROVE_SUB', paymentId: d.paymentId }),
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: 'ตรวจสลิป', uri: d.reviewUrl },
          },
        ],
      },
    },
  }
}

export function buildSubscriptionResultFlex(d: SubscriptionResultData): FlexMessage {
  return {
    type: 'flex',
    altText: d.ok ? 'อนุมัติค่าบริการแล้ว' : 'สลิปค่าบริการไม่ผ่าน',
    contents: {
      type: 'bubble',
      header: header(d.ok ? 'ชำระค่าบริการสำเร็จ' : 'สลิปไม่ผ่านการอนุมัติ', d.billNo, d.ok ? COLORS.green : COLORS.red),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          row('ยอด', baht(d.amount)),
          ...(d.ok ? [row('ใช้ได้ถึง', d.expiresAt, COLORS.green, true)] : []),
          ...(d.reason
            ? [
                {
                  type: 'text' as const,
                  text: d.reason,
                  size: 'sm' as const,
                  color: COLORS.red,
                  wrap: true,
                  margin: 'md' as const,
                },
              ]
            : []),
        ],
      },
    },
  }
}
