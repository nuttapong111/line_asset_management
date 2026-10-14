import { describe, expect, it } from 'vitest'
import { buildLiffPathMessage, liffPath } from './liffHelpers'

describe('liffHelpers', () => {
  it('builds absolute LIFF path', () => {
    const u = liffPath('/payment/1')
    expect(u).toMatch(/\/payment\/1$/)
    expect(u.startsWith('http')).toBe(true)
  })

  it('buildLiffPathMessage truncates and sets uri action', () => {
    const msg = buildLiffPathMessage('/tenant/home', {
      title: 'X'.repeat(50),
      text: 'Y'.repeat(80),
      label: 'Z'.repeat(30),
    })
    expect(msg.type).toBe('template')
    if (msg.template.type !== 'buttons') throw new Error('expected buttons')
    expect(msg.template.title!.length).toBeLessThanOrEqual(40)
    expect(msg.template.text.length).toBeLessThanOrEqual(60)
    expect(msg.template.actions[0].type).toBe('uri')
  })
})
