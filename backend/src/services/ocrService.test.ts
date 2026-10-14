import { describe, expect, it } from 'vitest'
import { extractAccountCandidates, extractAmount } from './ocrService'

describe('extractAmount', () => {
  it('picks closest amount to expected', () => {
    const text = 'โอนสำเร็จ จำนวน 5,450.00 บาท ค่าธรรมเนียม 0.00'
    expect(extractAmount(text, 5450)).toBe(5450)
  })

  it('reads integer with บาท', () => {
    expect(extractAmount('ยอดชำระ 8500 บาท', 8500)).toBe(8500)
  })

  it('returns null when no numbers', () => {
    expect(extractAmount('ไม่มีตัวเลข', 100)).toBeNull()
  })
})

describe('extractAccountCandidates', () => {
  it('finds mobile PromptPay', () => {
    const c = extractAccountCandidates('โอนไปพร้อมเพย์ 081-234-5678 สำเร็จ')
    expect(c.some((x) => x.endsWith('812345678') || x === '0812345678')).toBe(true)
  })

  it('finds 13-digit citizen id style', () => {
    const c = extractAccountCandidates('เลขที่ 1234567890123')
    expect(c).toContain('1234567890123')
  })
})
