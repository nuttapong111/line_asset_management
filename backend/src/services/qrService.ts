// promptpay-qr has no types; require it dynamically
// eslint-disable-next-line @typescript-eslint/no-var-requires
const generatePayload = require('promptpay-qr') as (id: string, opts: { amount?: number }) => string

export function generatePromptPayPayload(promptpayNumber: string, amount: number): string {
  return generatePayload(promptpayNumber, { amount })
}
