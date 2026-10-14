import { describe, expect, it } from 'vitest'
import { isAllowedFilePath, issueFileViewUrl } from './fileViewService'
import { env } from '../lib/env'
import jwt from 'jsonwebtoken'

describe('isAllowedFilePath', () => {
  it('allows receipt, slip, contract pdf/signed', () => {
    expect(isAllowedFilePath('payments/p1/receipt/pdf')).toBe(true)
    expect(isAllowedFilePath('/payments/p1/slip')).toBe(true)
    expect(isAllowedFilePath('contracts/c1/pdf')).toBe(true)
    expect(isAllowedFilePath('contracts/c1/signed')).toBe(true)
  })

  it('rejects arbitrary paths', () => {
    expect(isAllowedFilePath('etc/passwd')).toBe(false)
    expect(isAllowedFilePath('payments/p1/secret')).toBe(false)
    expect(isAllowedFilePath('admin/reset')).toBe(false)
  })
})

describe('issueFileViewUrl', () => {
  it('issues short-lived JWT URL', () => {
    const url = issueFileViewUrl('payments/abc/receipt/pdf', { download: true })
    expect(url.startsWith(env.BACKEND_URL.replace(/\/$/, ''))).toBe(true)
    expect(url).toContain('/api/public/file?')
    expect(url).toContain('dl=1')
    const token = new URL(url).searchParams.get('token')!
    const dec = jwt.verify(token, env.JWT_SECRET) as { path: string; purpose: string }
    expect(dec.purpose).toBe('file_view')
    expect(dec.path).toBe('payments/abc/receipt/pdf')
  })
})
