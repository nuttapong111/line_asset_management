import { TemplateMessage } from '@line/bot-sdk'
import { liffEntryUrl } from '../env'

export function liffPath(path: string): string {
  const base = liffEntryUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export function buildLiffPathMessage(
  path: string,
  opts?: { title?: string; text?: string; label?: string }
): TemplateMessage {
  return {
    type: 'template',
    altText: opts?.label || 'เปิด PropFlow',
    template: {
      type: 'buttons',
      title: (opts?.title || 'PropFlow').slice(0, 40),
      text: (opts?.text || 'แตะปุ่มด้านล่างเพื่อเปิด').slice(0, 60),
      actions: [{ type: 'uri', label: (opts?.label || 'เปิด').slice(0, 20), uri: liffPath(path) }],
    },
  }
}
