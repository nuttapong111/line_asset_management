import { describe, expect, it } from 'vitest'
import {
  buildEntryMessage,
  buildFlex,
  buildManagerQuickMenu,
  buildQuickMenu,
} from './lineService'

describe('lineService message helpers', () => {
  it('buildEntryMessage opens LIFF entry', () => {
    const m = buildEntryMessage('สวัสดี', 'เปิด')
    expect(m.type).toBe('template')
    if (m.template.type !== 'buttons') throw new Error('buttons')
    expect(m.template.actions[0].type).toBe('uri')
  })

  it('quick menus have tenant vs manager labels', () => {
    const t = buildQuickMenu()
    const m = buildManagerQuickMenu()
    expect(t.items.some((i) => i.type === 'action' && i.action.type === 'message' && i.action.label === 'ชำระเงิน')).toBe(
      true
    )
    expect(m.items.some((i) => i.type === 'action' && i.action.type === 'message' && i.action.label === 'Dashboard')).toBe(
      true
    )
  })

  it('buildFlex is identity', () => {
    const flex = { type: 'flex' as const, altText: 'x', contents: { type: 'bubble' as const, body: { type: 'box' as const, layout: 'vertical' as const, contents: [] } } }
    expect(buildFlex(flex)).toBe(flex)
  })
})
