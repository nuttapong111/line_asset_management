import { describe, expect, it } from 'vitest'
import { buildContractText, type ContractData } from './contractTemplate'

const sample: ContractData = {
  contractNo: 'CTR-2026-00001',
  landlordName: 'สมชาย',
  propertyName: 'หอสุขใจ',
  propertyAddress: 'กรุงเทพฯ',
  roomNumber: '201',
  floor: 2,
  tenantName: 'สมหญิง',
  tenantPhone: '0812345678',
  rentAmount: 5000,
  deposit: 10000,
  dueDay: 5,
  lateFeePerDay: 30,
  startDate: new Date(2026, 0, 1),
  endDate: new Date(2026, 11, 31),
  terms: 'ห้ามเลี้ยงสัตว์\nห้ามสูบบุหรี่',
}

describe('buildContractText', () => {
  it('includes parties, rent, deposit, and custom terms', () => {
    const sections = buildContractText(sample)
    const blob = sections.map((s) => `${s.heading || ''}\n${s.lines.join('\n')}`).join('\n')
    expect(blob).toContain('สมชาย')
    expect(blob).toContain('สมหญิง')
    expect(blob).toContain('201')
    expect(blob).toContain('5,000')
    expect(blob).toContain('10,000')
    expect(blob).toContain('ห้ามเลี้ยงสัตว์')
    expect(sections.some((s) => s.heading?.includes('เงื่อนไขเพิ่มเติม'))).toBe(true)
  })

  it('omits terms section when empty', () => {
    const sections = buildContractText({ ...sample, terms: '   ' })
    expect(sections.every((s) => !s.heading?.includes('เงื่อนไขเพิ่มเติม'))).toBe(true)
  })
})
