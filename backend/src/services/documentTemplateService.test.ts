import { describe, expect, it } from 'vitest'
import { parsePlacements } from './documentTemplateService'

describe('parsePlacements', () => {
  it('returns empty for non-array', () => {
    expect(parsePlacements(null)).toEqual([])
    expect(parsePlacements({})).toEqual([])
  })

  it('keeps valid placements and clamps coords', () => {
    const out = parsePlacements([
      { key: 'total', x: 1.5, y: -0.2, fontSize: 18, align: 'center', width: 0.5 },
      { key: 'bad' },
      null,
      { key: 'ok', x: 0.1, y: 0.2 },
    ])
    expect(out).toHaveLength(2)
    expect(out[0].key).toBe('total')
    expect(out[0].x).toBe(1)
    expect(out[0].y).toBe(0)
    expect(out[0].align).toBe('center')
    expect(out[1].fontSize).toBe(14)
  })
})
