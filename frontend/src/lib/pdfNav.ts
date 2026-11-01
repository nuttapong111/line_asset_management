import { NavigateFunction } from 'react-router-dom'

/** Open PDF via in-app viewer (works inside LINE LIFF). */
export function openPdfViewer(
  nav: NavigateFunction,
  apiPath: string,
  opts?: { title?: string; print?: boolean; sub?: string }
) {
  const q = new URLSearchParams({
    path: apiPath.replace(/^\//, ''),
    title: opts?.title || 'เอกสาร PDF',
  })
  if (opts?.print) q.set('print', '1')
  if (opts?.sub) q.set('sub', opts.sub)
  nav(`/pdf-viewer?${q.toString()}`)
}
