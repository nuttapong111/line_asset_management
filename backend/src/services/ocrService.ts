/**
 * Slip OCR (optional). Real implementation would call a slip-verify API
 * (e.g. EasySlip / SlipOK / Google Vision). For now returns a mock result
 * so the approve/reject flow can be exercised end-to-end.
 */
export interface OcrResult {
  amount: number | null
  date: Date | null
  matched: boolean
}

export async function ocrSlip(_slipUrl: string, expectedAmount: number): Promise<OcrResult> {
  // Mock: assume the slip matches the expected amount.
  return {
    amount: expectedAmount,
    date: new Date(),
    matched: true,
  }
}
