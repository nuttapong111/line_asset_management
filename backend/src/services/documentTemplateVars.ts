/** Variable catalog for document template editor + PDF merge */

export type TemplateVarDef = {
  key: string
  label: string
  sample: string
}

export const CONTRACT_VARS: TemplateVarDef[] = [
  { key: 'contractNo', label: 'เลขที่สัญญา', sample: 'CTR-2026-00001' },
  { key: 'landlordName', label: 'ชื่อผู้ให้เช่า', sample: 'คุณสมชาย ใจดี' },
  { key: 'propertyName', label: 'ชื่อทรัพย์สิน', sample: 'หอพักสุขใจ' },
  { key: 'propertyAddress', label: 'ที่อยู่ทรัพย์สิน', sample: '123 ถ.สุขุมวิท กรุงเทพฯ' },
  { key: 'roomNumber', label: 'เลขห้อง', sample: '301' },
  { key: 'floor', label: 'ชั้น', sample: '3' },
  { key: 'tenantName', label: 'ชื่อผู้เช่า', sample: 'คุณสมหญิง รักดี' },
  { key: 'tenantIdCard', label: 'เลขบัตรประชาชน', sample: '1-2345-67890-12-3' },
  { key: 'tenantPhone', label: 'เบอร์โทรผู้เช่า', sample: '081-234-5678' },
  { key: 'rentAmount', label: 'ค่าเช่า', sample: '8,500.00' },
  { key: 'deposit', label: 'เงินมัดจำ', sample: '17,000.00' },
  { key: 'dueDay', label: 'วันครบกำหนดชำระ', sample: '5' },
  { key: 'lateFeePerDay', label: 'ค่าปรับ/วัน', sample: '30.00' },
  { key: 'startDate', label: 'วันเริ่มสัญญา', sample: '1 สิงหาคม 2569' },
  { key: 'endDate', label: 'วันสิ้นสุดสัญญา', sample: '31 กรกฎาคม 2570' },
  { key: 'terms', label: 'เงื่อนไขเพิ่มเติม', sample: 'ห้ามเลี้ยงสัตว์' },
]

export const RECEIPT_VARS: TemplateVarDef[] = [
  { key: 'receiptNo', label: 'เลขที่ใบเสร็จ', sample: 'RCP-2026-00001' },
  { key: 'date', label: 'วันที่', sample: '1 สิงหาคม 2569' },
  { key: 'propertyName', label: 'ชื่อทรัพย์สิน', sample: 'หอพักสุขใจ' },
  { key: 'propertyAddress', label: 'ที่อยู่ทรัพย์สิน', sample: '123 ถ.สุขุมวิท กรุงเทพฯ' },
  { key: 'tenantName', label: 'ชื่อผู้เช่า', sample: 'คุณสมหญิง รักดี' },
  { key: 'roomNumber', label: 'เลขห้อง', sample: '301' },
  { key: 'rentAmount', label: 'ค่าเช่า', sample: '8,500.00' },
  { key: 'electricAmount', label: 'ค่าไฟฟ้า', sample: '450.00' },
  { key: 'waterAmount', label: 'ค่าน้ำ', sample: '120.00' },
  { key: 'commonFee', label: 'ค่าส่วนกลาง', sample: '300.00' },
  { key: 'lateFee', label: 'ค่าปรับล่าช้า', sample: '0.00' },
  { key: 'total', label: 'ยอดรวม', sample: '9,370.00' },
  { key: 'itemsSummary', label: 'สรุปรายการ', sample: 'ค่าเช่า 8,500.00\nค่าไฟฟ้า 450.00\nค่าน้ำ 120.00' },
]

export function varsForType(type: 'CONTRACT' | 'RECEIPT'): TemplateVarDef[] {
  return type === 'CONTRACT' ? CONTRACT_VARS : RECEIPT_VARS
}

export function sampleValues(type: 'CONTRACT' | 'RECEIPT'): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of varsForType(type)) out[v.key] = v.sample
  return out
}
