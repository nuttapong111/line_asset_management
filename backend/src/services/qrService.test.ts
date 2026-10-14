import { describe, expect, it } from 'vitest'
import { generatePromptPayPayload } from './qrService'

describe('qrService', () => {
  it('embeds PromptPay id and amount in payload', () => {
    const payload = generatePromptPayPayload('0812345678', 1500.5)
    expect(typeof payload).toBe('string')
    expect(payload.length).toBeGreaterThan(20)
    // EMV QR: Payload Format Indicator + Merchant Account Information
    expect(payload.startsWith('000201')).toBe(true)
    // Amount tag 54 should appear when amount is set
    expect(payload).toContain('54')
  })

  it('produces different payloads for different amounts', () => {
    const a = generatePromptPayPayload('0812345678', 100)
    const b = generatePromptPayPayload('0812345678', 200)
    expect(a).not.toBe(b)
  })
})
