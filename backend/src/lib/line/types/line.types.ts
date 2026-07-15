export interface InvoiceLineItem {
  label: string
  amount: number
}

export interface InvoiceData {
  invoiceId: string
  roomNumber: string
  tenantName: string
  month: number
  year: number
  items: InvoiceLineItem[]
  total: number
  dueDate: string
  liffUrl: string
  title?: string
}

export interface ReminderData {
  invoiceId: string
  roomNumber: string
  tenantName: string
  daysLeft: number
  amount: number
  dueDate: string
  liffUrl: string
}

export interface OverdueData {
  invoiceId: string
  roomNumber: string
  tenantName: string
  daysOverdue: number
  originalAmount: number
  lateFee: number
  total: number
  liffUrl: string
}

export interface ReceiptData {
  paymentId: string
  receiptNo: string
  roomNumber: string
  tenantName: string
  amount: number
  date: string
  receiptUrl: string
  historyUrl?: string
}

export interface ContractExpiryData {
  contractId: string
  roomNumber: string
  tenantName: string
  daysLeft: number
  endDate: string
  renewUrl: string
  viewUrl: string
}

export interface MaintData {
  ticketId: string
  ticketNo: string
  title: string
  roomNumber: string
  tenantName: string
  category: string
  createdAt: string
  viewUrl: string
}

export interface SlipReceivedData {
  paymentId: string
  invoiceId: string
  roomNumber: string
  tenantName: string
  amount: number
  slipUrl: string
  reviewUrl: string
}

export interface LinkedData {
  tenantId: string
  tenantName: string
  roomNumber: string
  linkedAt: string
  profileUrl: string
}

export interface InviteData {
  propertyName: string
  roomNumber: string
  rentAmount: number
  startDate: string
  inviteUrl: string
}

export interface ChatMessageData {
  tenantId: string
  tenantName: string
  message: string
}

export interface SubscriptionReminderData {
  ownerName: string
  daysLeft: number
  expiresAt: string
  amount: number
  billNo: string
  payUrl: string
  status: string
}

export interface SubscriptionSlipReceivedData {
  paymentId: string
  billNo: string
  ownerName: string
  amount: number
  reviewUrl: string
}

export interface SubscriptionResultData {
  ok: boolean
  ownerName: string
  billNo: string
  amount: number
  expiresAt: string
  reason: string | null
}
