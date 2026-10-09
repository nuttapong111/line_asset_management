export type OwnerPlan = 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'PERMANENT'

export const OWNER_PLAN_OPTIONS: { value: OwnerPlan; label: string; hint: string }[] = [
  { value: 'TRIAL', label: 'ทดลองใช้', hint: 'เริ่มนับเมื่อเข้าใช้งานครั้งแรก' },
  { value: 'MONTHLY', label: 'รายเดือน', hint: 'เปิดสิทธิ์ทันที 30 วัน' },
  { value: 'YEARLY', label: 'รายปี', hint: 'เปิดสิทธิ์ทันที 365 วัน' },
  { value: 'PERMANENT', label: 'ถาวร (ใช้งานเอง)', hint: 'ไม่มีวันหมดอายุ ไม่ต้องชำระ' },
]

export const OWNER_PLAN_LABEL: Record<OwnerPlan, string> = {
  TRIAL: 'ทดลองใช้',
  MONTHLY: 'รายเดือน',
  YEARLY: 'รายปี',
  PERMANENT: 'ถาวร',
}
