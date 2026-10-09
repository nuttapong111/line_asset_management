import axios from 'axios'
import Tesseract from 'tesseract.js'
import { env } from '../lib/env'

/**
 * Slip OCR — advisory only; manager always makes the final approve/reject call.
 *
 * Providers:
 *   tesseract (default) — local OCR on this server, slip image never leaves the app
 *   easyslip            — optional paid external verify (if configured)
 */

export interface SlipOcrExpect {
  expectedAmount: number
  /** PromptPay / bank account numbers that are valid destinations for this property */
  expectedAccounts?: string[]
}

export interface OcrResult {
  amount: number | null
  date: Date | null
  /** Amount matches invoice (within tolerance) */
  amountMatched: boolean
  /** Destination account matches property PromptPay/bank; null = nothing to compare */
  accountMatched: boolean | null
  /** Parsed destination-looking number from the slip (digits) */
  parsedAccount: string | null
  /** Overall advisory match: amount OK and account OK (or N/A) */
  matched: boolean
  provider: string
  note?: string
  rawTextPreview?: string
}

const AMOUNT_TOLERANCE = 1 // baht — OCR often misreads cents

export async function ocrSlip(
  slipUrl: string,
  expected: number | SlipOcrExpect,
  buffer?: Buffer
): Promise<OcrResult> {
  const opts: SlipOcrExpect =
    typeof expected === 'number' ? { expectedAmount: expected } : expected

  try {
    if (env.SLIP_VERIFY_PROVIDER === 'easyslip' && env.EASYSLIP_API_KEY) {
      return await verifyWithEasySlip(slipUrl, opts, buffer)
    }
    if (buffer) {
      return await verifyWithTesseract(buffer, opts)
    }
    // No buffer (url-only) — try to keep local: cannot fetch private R2 without buffer
    return {
      amount: null,
      date: null,
      amountMatched: false,
      accountMatched: null,
      parsedAccount: null,
      matched: false,
      provider: 'tesseract',
      note: 'ไม่มีไฟล์รูปสำหรับ OCR — กรุณาอัปโหลดสลิปใหม่หรือกดตรวจใหม่',
    }
  } catch (e) {
    return {
      amount: null,
      date: null,
      amountMatched: false,
      accountMatched: null,
      parsedAccount: null,
      matched: false,
      provider: env.SLIP_VERIFY_PROVIDER || 'tesseract',
      note: `ตรวจสลิปอัตโนมัติไม่สำเร็จ (${(e as Error).message}) — กรุณาตรวจสอบด้วยตนเอง`,
    }
  }
}

function buildResult(
  amount: number | null,
  date: Date | null,
  parsedAccount: string | null,
  opts: SlipOcrExpect,
  provider: string,
  rawTextPreview?: string
): OcrResult {
  const amountMatched =
    amount != null && Math.abs(amount - opts.expectedAmount) <= AMOUNT_TOLERANCE

  const expectedAccounts = (opts.expectedAccounts || [])
    .map(digitsOnly)
    .filter((d) => d.length >= 4)

  let accountMatched: boolean | null = null
  if (expectedAccounts.length > 0) {
    accountMatched = parsedAccount
      ? accountsOverlap(expectedAccounts, [parsedAccount])
      : findAccountInCandidates(expectedAccounts, rawTextPreview || '')
    if (!accountMatched && rawTextPreview) {
      accountMatched = findAccountInCandidates(expectedAccounts, rawTextPreview)
    }
  }

  const matched = amountMatched && accountMatched !== false

  const parts: string[] = []
  if (amountMatched) parts.push('ยอดตรง')
  else if (amount != null) parts.push(`ยอดไม่ตรง (อ่านได้ ฿${amount.toLocaleString('th-TH')})`)
  else parts.push('อ่านยอดไม่ได้')

  if (accountMatched === true) parts.push('บัญชีปลายทางตรง')
  else if (accountMatched === false) parts.push('บัญชีปลายทางไม่ตรงหรือไม่พบ')
  else parts.push('ไม่ได้ตั้งบัญชีปลายทางให้เทียบ')

  return {
    amount,
    date,
    amountMatched,
    accountMatched,
    parsedAccount,
    matched,
    provider,
    note: `${parts.join(' · ')} (แนะนำเท่านั้น — แอดมินเป็นผู้อนุมัติ)`,
    rawTextPreview: rawTextPreview?.slice(0, 280),
  }
}

function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '')
}

function accountsOverlap(expected: string[], found: string[]): boolean {
  for (const exp of expected) {
    for (const f of found) {
      if (!f || f.length < 4) continue
      if (f === exp || f.includes(exp) || exp.includes(f)) return true
      // PromptPay phone: compare last 9–10 digits
      if (exp.length >= 9 && f.length >= 9) {
        if (f.slice(-9) === exp.slice(-9) || f.slice(-10) === exp.slice(-10)) return true
      }
      // Bank account: last 6–7 digits often unique enough on slips
      if (exp.length >= 6 && f.length >= 6 && f.slice(-6) === exp.slice(-6)) return true
    }
  }
  return false
}

function findAccountInCandidates(expected: string[], text: string): boolean {
  const candidates = extractAccountCandidates(text)
  return accountsOverlap(expected, candidates)
}

/** Pull plausible account / PromptPay digit strings from OCR text */
export function extractAccountCandidates(text: string): string[] {
  const out = new Set<string>()
  const normalized = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')

  // Formatted bank accounts: 123-4-56789-0
  for (const m of normalized.matchAll(/\b(\d{3}[-\s]?\d[-\s]?\d{5,6}[-\s]?\d)\b/g)) {
    const d = digitsOnly(m[1])
    if (d.length >= 10 && d.length <= 12) out.add(d)
  }
  // Phone / PromptPay mobile
  for (const m of normalized.matchAll(/(?:0|\+?66)[\d\-\s]{8,12}\d/g)) {
    let d = digitsOnly(m[0])
    if (d.startsWith('66') && d.length >= 11) d = '0' + d.slice(2)
    if (d.length === 10 && d.startsWith('0')) out.add(d)
  }
  // Citizen ID / PromptPay tax id
  for (const m of normalized.matchAll(/\b\d{13}\b/g)) {
    out.add(m[0])
  }
  // Long digit runs
  for (const m of normalized.matchAll(/\d[\d\-\s]{8,18}\d/g)) {
    const d = digitsOnly(m[0])
    if (d.length >= 9 && d.length <= 15) out.add(d)
  }
  return [...out]
}

/** Best amount guess from OCR text relative to expected invoice total */
export function extractAmount(text: string, expectedAmount: number): number | null {
  const candidates: number[] = []
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/g)) {
    const n = Number(m[1].replace(/,/g, ''))
    if (!Number.isNaN(n) && n >= 1 && n <= 5_000_000) candidates.push(n)
  }
  // Also plain integers near "บาท"
  for (const m of text.matchAll(/(\d{2,7})\s*(?:บาท|฿)/gi)) {
    const n = Number(m[1])
    if (!Number.isNaN(n) && n >= 1) candidates.push(n)
  }
  if (!candidates.length) return null

  // Prefer closest to expected within a generous window, else closest overall
  const ranked = [...candidates].sort(
    (a, b) => Math.abs(a - expectedAmount) - Math.abs(b - expectedAmount)
  )
  const best = ranked[0]
  // If wildly off (>50% and >200 baht), still return best guess for admin display
  return best
}

function extractDate(text: string): Date | null {
  const m = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!m) return null
  let year = Number(m[3])
  if (year < 100) year += 2500 // Buddhist short year guess
  if (year > 2400) year -= 543 // convert BE → CE
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]))
  return Number.isNaN(d.getTime()) ? null : d
}

function pickParsedAccount(text: string, expected: string[]): string | null {
  const candidates = extractAccountCandidates(text)
  if (!candidates.length) return null
  const exp = expected.map(digitsOnly).filter((d) => d.length >= 4)
  if (exp.length) {
    for (const c of candidates) {
      if (accountsOverlap(exp, [c])) return c
    }
  }
  // Prefer 10-digit phone or 10–12 digit bank-looking
  return (
    candidates.find((c) => c.length === 10 && c.startsWith('0')) ||
    candidates.find((c) => c.length >= 10 && c.length <= 12) ||
    candidates[0]
  )
}

async function verifyWithTesseract(buffer: Buffer, opts: SlipOcrExpect): Promise<OcrResult> {
  const {
    data: { text },
  } = await Tesseract.recognize(buffer, 'tha+eng', {
    // Keep logs quiet in production
    logger: () => {},
  })

  const amount = extractAmount(text, opts.expectedAmount)
  const date = extractDate(text)
  const expectedAccounts = (opts.expectedAccounts || []).map(digitsOnly).filter((d) => d.length >= 4)
  const parsedAccount = pickParsedAccount(text, expectedAccounts)

  return buildResult(amount, date, parsedAccount, opts, 'tesseract', text)
}

async function verifyWithEasySlip(
  slipUrl: string,
  opts: SlipOcrExpect,
  buffer?: Buffer
): Promise<OcrResult> {
  const headers = { Authorization: `Bearer ${env.EASYSLIP_API_KEY}` }
  let data: Record<string, unknown>

  if (buffer) {
    const res = await axios.post(
      'https://developer.easyslip.com/api/v1/verify',
      { image: buffer.toString('base64') },
      { headers, timeout: 15000 }
    )
    data = res.data
  } else {
    const res = await axios.get('https://developer.easyslip.com/api/v1/verify', {
      params: { url: slipUrl },
      headers,
      timeout: 15000,
    })
    data = res.data
  }

  const payload = (data?.data ?? {}) as Record<string, unknown>
  const amountObj = payload.amount as { amount?: number } | number | undefined
  const amount =
    typeof amountObj === 'number' ? amountObj : (amountObj?.amount ?? null)
  const dateStr = payload.date as string | undefined
  const date = dateStr ? new Date(dateStr) : null

  const receiver = (payload.receiver || payload.to || {}) as Record<string, unknown>
  const proxy = receiver.proxy as { value?: string } | undefined
  const accountFromApi = digitsOnly(
    String(receiver.account || proxy?.value || receiver.number || '')
  )
  const textBlob = JSON.stringify(payload)
  const parsedAccount =
    accountFromApi ||
    pickParsedAccount(textBlob, (opts.expectedAccounts || []).map(digitsOnly))

  return buildResult(amount, date, parsedAccount || null, opts, 'easyslip', textBlob)
}
