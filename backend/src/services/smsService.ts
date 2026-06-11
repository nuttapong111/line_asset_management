import { env, isTwilioConfigured } from '../lib/env'

let client: ReturnType<typeof import('twilio')> | null = null
if (isTwilioConfigured) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')
  client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; mock: boolean }> {
  if (!client) {
    console.log(`[SMS mock] → ${to}: ${body}`)
    return { ok: true, mock: true }
  }
  try {
    await client.messages.create({ to, from: env.TWILIO_FROM_NUMBER, body })
    return { ok: true, mock: false }
  } catch (err) {
    console.error('[SMS] send failed', err)
    return { ok: false, mock: false }
  }
}
