import { describe, expect, it } from 'vitest'
import { detectIntent } from './chatQueryService'

describe('detectIntent tenant', () => {
  it('maps common Thai keywords', () => {
    expect(detectIntent('ขอดูสัญญาเช่า', 'TENANT')).toBe('TENANT_CONTRACT')
    expect(detectIntent('สรุปข้อมูล', 'TENANT')).toBe('TENANT_SUMMARY')
    expect(detectIntent('ใบเสร็จล่าสุด', 'TENANT')).toBe('TENANT_RECEIPTS')
    expect(detectIntent('แจ้งซ่อม', 'TENANT')).toBe('TENANT_MAINTENANCE')
    expect(detectIntent('ติดต่อเจ้าของ', 'TENANT')).toBe('TENANT_CONTACT')
    expect(detectIntent('ชำระเงิน', 'TENANT')).toBe('TENANT_PAY')
    expect(detectIntent('ค้างชำระกี่ยอด', 'TENANT')).toBe('TENANT_OVERDUE')
    expect(detectIntent('ใบแจ้งหนี้', 'TENANT')).toBe('TENANT_BILLS')
    expect(detectIntent('ช่วยเหลือ', 'TENANT')).toBe('TENANT_HELP')
  })

  it('returns null for unknown tenant text', () => {
    expect(detectIntent('อากาศดีจัง', 'TENANT')).toBeNull()
  })
})

describe('detectIntent manager', () => {
  it('maps dashboard / billing / slips', () => {
    expect(detectIntent('ขอดู dashboard', 'MANAGER')).toBe('MANAGER_DASHBOARD')
    expect(detectIntent('ออกบิล', 'MANAGER')).toBe('MANAGER_BILLING')
    expect(detectIntent('รายงานรายได้', 'MANAGER')).toBe('MANAGER_REPORTS')
    expect(detectIntent('ยอดค้างชำระ', 'MANAGER')).toBe('MANAGER_OVERDUE')
    expect(detectIntent('สลิปรอตรวจ', 'MANAGER')).toBe('MANAGER_SLIPS')
    expect(detectIntent('ห้องว่างกี่ห้อง', 'MANAGER')).toBe('MANAGER_OCCUPANCY')
    expect(detectIntent('สรุปรายรับ', 'MANAGER')).toBe('MANAGER_REVENUE')
    expect(detectIntent('help', 'MANAGER')).toBe('MANAGER_HELP')
  })
})
