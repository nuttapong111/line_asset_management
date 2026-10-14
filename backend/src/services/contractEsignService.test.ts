import { describe, expect, it } from 'vitest'
import { parseSignaturePng } from './contractEsignService'

/** Minimal valid 1×1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('parseSignaturePng', () => {
  it('accepts data URL PNG', () => {
    const buf = parseSignaturePng(`data:image/png;base64,${TINY_PNG.toString('base64')}`)
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
  })

  it('accepts raw base64', () => {
    const buf = parseSignaturePng(TINY_PNG.toString('base64'))
    expect(buf.length).toBe(TINY_PNG.length)
  })

  it('rejects empty / non-png', () => {
    expect(() => parseSignaturePng('abc')).toThrow()
    const fake = Buffer.alloc(80, 0x41).toString('base64')
    expect(() => parseSignaturePng(fake)).toThrow(/PNG/)
  })
})
