/** Seconds remaining until QR expiry (floor). Never negative. */
export function qrSecondsLeft(expiresAt: string | Date | undefined | null, now = Date.now()): number {
  if (!expiresAt) return 30 * 60
  const left = Math.floor((new Date(expiresAt).getTime() - now) / 1000)
  return Math.max(0, left || 30 * 60)
}

export function formatCountdown(seconds: number): { mm: string; ss: string; expired: boolean } {
  const s = Math.max(0, Math.floor(seconds))
  return {
    mm: String(Math.floor(s / 60)).padStart(2, '0'),
    ss: String(s % 60).padStart(2, '0'),
    expired: s <= 0,
  }
}
