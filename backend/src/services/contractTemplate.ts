export interface ContractData {
  contractNo: string
  landlordName: string
  propertyName: string
  propertyAddress: string
  roomNumber: string
  floor?: number | null
  tenantName: string
  tenantIdCard?: string | null
  tenantPhone: string
  rentAmount: number
  deposit: number
  dueDay: number
  lateFeePerDay: number
  startDate: Date
  endDate: Date
  terms?: string | null
}

export interface ContractSection {
  heading?: string
  lines: string[]
}

function thaiDate(d: Date): string {
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30)))
}

export function buildContractText(d: ContractData): ContractSection[] {
  const sections: ContractSection[] = []

  sections.push({
    lines: [
      `สัญญานี้ทำขึ้นเมื่อวันที่ ${thaiDate(d.startDate)} ระหว่าง`,
      `"${d.landlordName}" (ผู้ให้เช่า) ฝ่ายหนึ่ง`,
      `กับ "${d.tenantName}" (ผู้เช่า) อีกฝ่ายหนึ่ง`,
    ],
  })

  sections.push({
    heading: 'ข้อ 1. ทรัพย์สินที่เช่า',
    lines: [
      `ผู้ให้เช่าตกลงให้เช่า ${d.propertyName} ห้องเลขที่ ${d.roomNumber}${d.floor ? ` ชั้น ${d.floor}` : ''}`,
      `ที่อยู่ ${d.propertyAddress}`,
    ],
  })

  sections.push({
    heading: 'ข้อ 2. กำหนดระยะเวลาเช่า',
    lines: [
      `มีกำหนด ${monthsBetween(d.startDate, d.endDate)} เดือน`,
      `เริ่มตั้งแต่วันที่ ${thaiDate(d.startDate)} ถึงวันที่ ${thaiDate(d.endDate)}`,
    ],
  })

  sections.push({
    heading: 'ข้อ 3. ค่าเช่าและการชำระเงิน',
    lines: [
      `ค่าเช่าเดือนละ ${d.rentAmount.toLocaleString('th-TH')} บาท`,
      `ชำระภายในวันที่ ${d.dueDay} ของทุกเดือน`,
      `หากชำระล่าช้า คิดค่าปรับวันละ ${d.lateFeePerDay.toLocaleString('th-TH')} บาท`,
    ],
  })

  sections.push({
    heading: 'ข้อ 4. เงินประกัน',
    lines: [
      `ผู้เช่าวางเงินประกันจำนวน ${d.deposit.toLocaleString('th-TH')} บาท`,
      `ผู้ให้เช่าจะคืนเงินประกันเมื่อสิ้นสุดสัญญาและส่งมอบห้องในสภาพเรียบร้อย`,
    ],
  })

  if (d.terms && d.terms.trim()) {
    sections.push({ heading: 'ข้อ 5. เงื่อนไขเพิ่มเติม', lines: d.terms.split('\n').filter(Boolean) })
  }

  return sections
}
