import { describe, expect, it } from 'vitest'
import { extractStorageKey } from './storageService'

describe('extractStorageKey', () => {
  it('parses r2://bucket/key', () => {
    expect(extractStorageKey('r2://propflow/receipts/p1.pdf')).toBe('receipts/p1.pdf')
  })

  it('parses local upload URL', () => {
    expect(extractStorageKey('http://localhost:4000/uploads/slips/a.jpg')).toBe('slips/a.jpg')
  })

  it('parses amazonaws URL', () => {
    expect(extractStorageKey('https://bucket.s3.amazonaws.com/path/to/file.pdf')).toBe('path/to/file.pdf')
  })

  it('returns raw key as-is', () => {
    expect(extractStorageKey('already/a/key.png')).toBe('already/a/key.png')
  })

  it('handles empty', () => {
    expect(extractStorageKey('')).toBe('')
  })
})
