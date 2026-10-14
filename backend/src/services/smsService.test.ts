import { describe, expect, it } from 'vitest'
import { sendSms } from './smsService'

describe('sendSms', () => {
  it('returns mock success when Twilio not configured', async () => {
    const out = await sendSms('0812345678', 'test invite')
    // In CI/dev without Twilio credentials this is the safe path
    expect(out.ok).toBe(true)
    expect(typeof out.mock).toBe('boolean')
  })
})
