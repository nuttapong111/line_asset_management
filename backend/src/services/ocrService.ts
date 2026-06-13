import axios from 'axios'
import { env } from '../lib/env'

/**
 * Slip OCR / verification — a rough check to assist the manager before they
 * manually approve a payment. Pluggable provider:
 *
 *   SLIP_VERIFY_PROVIDER=easyslip + EASYSLIP_API_KEY  → real verification
 *   (anything else)                                    → mock (dev/testing)
 *
 * The result is advisory only; the manager always makes the final call.
 */
export interface OcrResult {
  amount: number | null
  date: Date | null
  /** true when the slip amount matches the invoice total (within tolerance) */
  matched: boolean
  /** which engine produced the result */
  provider: string
  /** short human-readable note for the reviewer */
  note?: string
}

const AMOUNT_TOLERANCE = 0.5 // baht

export async function ocrSlip(
  slipUrl: string,
  expectedAmount: number,
  buffer?: Buffer
): Promise<OcrResult> {
  try {
    if (env.SLIP_VERIFY_PROVIDER === 'easyslip' && env.EASYSLIP_API_KEY) {
      return await verifyWithEasySlip(slipUrl, expectedAmount, buffer)
    }
  } catch (e) {
    // Never block slip upload because verification failed — degrade to manual.
    return {
      amount: null,
      date: null,
      matched: false,
      provider: env.SLIP_VERIFY_PROVIDER,
      note: `ตรวจสลิปอัตโนมัติไม่สำเร็จ (${(e as Error).message}) — กรุณาตรวจสอบด้วยตนเอง`,
    }
  }

  // Mock fallback: we cannot actually read the image, so flag it for manual review.
  return {
    amount: null,
    date: null,
    matched: false,
    provider: 'mock',
    note: 'ยังไม่ได้เปิดใช้ระบบตรวจสลิปอัตโนมัติ — กรุณาตรวจยอดกับสลิปด้วยตนเอง',
  }
}

async function verifyWithEasySlip(
  slipUrl: string,
  expectedAmount: number,
  buffer?: Buffer
): Promise<OcrResult> {
  const headers = { Authorization: `Bearer ${env.EASYSLIP_API_KEY}` }
  let data: Record<string, unknown>

  if (buffer) {
    // image (base64) endpoint
    const res = await axios.post(
      'https://developer.easyslip.com/api/v1/verify',
      { image: buffer.toString('base64') },
      { headers, timeout: 15000 }
    )
    data = res.data
  } else {
    // url endpoint
    const res = await axios.get('https://developer.easyslip.com/api/v1/verify', {
      params: { url: slipUrl },
      headers,
      timeout: 15000,
    })
    data = res.data
  }

  // EasySlip wraps the parsed slip under data.data
  const payload = (data?.data ?? {}) as Record<string, unknown>
  const amountObj = payload.amount as { amount?: number } | number | undefined
  const amount =
    typeof amountObj === 'number' ? amountObj : (amountObj?.amount ?? null)
  const dateStr = payload.date as string | undefined
  const date = dateStr ? new Date(dateStr) : null
  const matched = amount != null && Math.abs(amount - expectedAmount) <= AMOUNT_TOLERANCE

  return {
    amount: amount ?? null,
    date,
    matched,
    provider: 'easyslip',
    note: matched
      ? 'ยอดในสลิปตรงกับใบแจ้งหนี้'
      : amount != null
        ? `ยอดในสลิป (฿${amount.toLocaleString('th-TH')}) ไม่ตรงกับใบแจ้งหนี้`
        : 'อ่านยอดจากสลิปไม่ได้',
  }
}
