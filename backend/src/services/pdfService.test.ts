import { describe, expect, it } from 'vitest'
import { generateContractPdf, generateReceipt } from './pdfService'

describe('pdfService', () => {
  it('generateReceipt returns a PDF buffer', async () => {
    const buf = await generateReceipt({
      receiptNo: 'RCP-TEST-1',
      date: new Date(2026, 0, 1),
      propertyName: 'หอทดสอบ',
      propertyAddress: 'กทม.',
      tenantName: 'ผู้เช่า',
      roomNumber: '101',
      items: [
        { label: 'ค่าเช่า', amount: 5000 },
        { label: 'ค่าไฟฟ้า', amount: 200 },
      ],
      total: 5200,
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(500)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('generateContractPdf returns a PDF buffer', async () => {
    const buf = await generateContractPdf({
      contractNo: 'CTR-TEST-1',
      landlordName: 'เจ้าของ',
      propertyName: 'หอ',
      propertyAddress: 'ที่อยู่',
      roomNumber: '1',
      floor: 1,
      tenantName: 'ผู้เช่า',
      tenantPhone: '0800000000',
      rentAmount: 4000,
      deposit: 8000,
      dueDay: 5,
      lateFeePerDay: 30,
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 11, 31),
      terms: null,
    })
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
