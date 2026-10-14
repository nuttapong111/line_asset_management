import { describe, expect, it, vi } from 'vitest'
import { openPdfViewer } from './pdfNav'

describe('openPdfViewer', () => {
  it('navigates to pdf-viewer with query', () => {
    const nav = vi.fn()
    openPdfViewer(nav, '/payments/p1/receipt/pdf', { title: 'ใบเสร็จ', print: true })
    expect(nav).toHaveBeenCalledTimes(1)
    const url = nav.mock.calls[0][0] as string
    expect(url.startsWith('/pdf-viewer?')).toBe(true)
    expect(url).toContain('path=payments%2Fp1%2Freceipt%2Fpdf')
    expect(url).toContain('print=1')
    expect(decodeURIComponent(url)).toContain('ใบเสร็จ')
  })
})
