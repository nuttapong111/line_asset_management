import { describe, expect, it } from 'vitest'
import { receiptPdfLiffUrl } from './paymentService'

describe('receiptPdfLiffUrl', () => {
  it('points to in-app pdf-viewer with encoded path', () => {
    const url = receiptPdfLiffUrl('pay_123')
    expect(url).toContain('/pdf-viewer?')
    expect(url).toContain(encodeURIComponent('payments/pay_123/receipt/pdf'))
    expect(url).toContain(encodeURIComponent('ใบเสร็จรับเงิน'))
  })
})
