import { ContractData } from './contractTemplate'

const baht = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const thaiDate = (d: Date) =>
  d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

export function contractValues(d: ContractData): Record<string, string> {
  return {
    contractNo: d.contractNo,
    landlordName: d.landlordName,
    propertyName: d.propertyName,
    propertyAddress: d.propertyAddress,
    roomNumber: d.roomNumber,
    floor: d.floor != null ? String(d.floor) : '',
    tenantName: d.tenantName,
    tenantIdCard: d.tenantIdCard || '',
    tenantPhone: d.tenantPhone,
    rentAmount: baht(d.rentAmount),
    deposit: baht(d.deposit),
    dueDay: String(d.dueDay),
    lateFeePerDay: baht(d.lateFeePerDay),
    startDate: thaiDate(d.startDate),
    endDate: thaiDate(d.endDate),
    terms: d.terms || '',
  }
}

export function receiptValues(input: {
  receiptNo: string
  date: Date
  propertyName: string
  propertyAddress?: string | null
  tenantName: string
  roomNumber: string
  rentAmount: number
  electricAmount: number
  waterAmount: number
  commonFee: number
  lateFee: number
  total: number
}): Record<string, string> {
  const lines = [
    { label: 'ค่าเช่า', amount: input.rentAmount },
    { label: 'ค่าไฟฟ้า', amount: input.electricAmount },
    { label: 'ค่าน้ำ', amount: input.waterAmount },
    { label: 'ค่าส่วนกลาง', amount: input.commonFee },
  ]
  if (input.lateFee > 0) lines.push({ label: 'ค่าปรับล่าช้า', amount: input.lateFee })

  return {
    receiptNo: input.receiptNo,
    date: thaiDate(input.date),
    propertyName: input.propertyName,
    propertyAddress: input.propertyAddress || '',
    tenantName: input.tenantName,
    roomNumber: input.roomNumber,
    rentAmount: baht(input.rentAmount),
    electricAmount: baht(input.electricAmount),
    waterAmount: baht(input.waterAmount),
    commonFee: baht(input.commonFee),
    lateFee: baht(input.lateFee),
    total: baht(input.total),
    itemsSummary: lines.map((l) => `${l.label} ${baht(l.amount)}`).join('\n'),
  }
}
