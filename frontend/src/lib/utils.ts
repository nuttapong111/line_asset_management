export function baht(n: number | string | undefined | null, digits = 0): string {
  const v = Number(n ?? 0)
  return (
    '฿' +
    v.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 2) })
  )
}

/** บิลและใบเสร็จ แสดงทศนิยมสองตำแหน่ง */
export function bahtExact(n: number | string | undefined | null): string {
  return baht(n, 2)
}

export function thaiDate(d: string | Date | undefined | null): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function thaiDateTime(d: string | Date | undefined | null): string {
  if (!d) return '-'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const THAI_MONTHS = [
  '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]
export function thaiMonth(m: number): string {
  return THAI_MONTHS[m] || String(m)
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}
