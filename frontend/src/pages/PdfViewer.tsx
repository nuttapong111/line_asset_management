import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import api from '../lib/axios'
import { liff, LIFF_ID } from '../lib/liff'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui'
import { TopBar } from '../components/layout/TopBar'

GlobalWorkerOptions.workerSrc = pdfWorker

/** LIFF in-app browser cannot render blob: URLs in iframe — use pdf.js canvas instead. */
export default function PdfViewer() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const printRootRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob>()
  const jwt = useAuthStore((s) => s.jwt)
  const ready = useAuthStore((s) => s.ready)
  const path = params.get('path') || ''
  const title = params.get('title') || 'เอกสาร'
  const autoPrint = params.get('print') === '1'
  const [url, setUrl] = useState<string>()
  const [mime, setMime] = useState('application/pdf')
  const [pdfReady, setPdfReady] = useState(false)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const isImage = mime.startsWith('image/')
  const isPdf = !isImage

  useEffect(() => {
    if (!path) {
      setError('ไม่พบเอกสาร')
      setLoading(false)
      return
    }
    if (!ready || !jwt) return

    let objectUrl: string | undefined
    setLoading(true)
    setError(undefined)
    setUrl(undefined)
    setPdfReady(false)
    blobRef.current = undefined

    const container = printRootRef.current
    if (container) container.innerHTML = ''

    api
      .get(`/${path.replace(/^\//, '')}`, { responseType: 'blob' })
      .then(async ({ data }) => {
        const type = data.type && data.type !== 'application/octet-stream' ? data.type : guessMime(path)
        if (type.includes('json')) {
          const text = await data.text()
          try {
            const j = JSON.parse(text) as { error?: string }
            setError(j.error || 'ไม่สามารถโหลดเอกสารได้')
          } catch {
            setError('ไม่สามารถโหลดเอกสารได้')
          }
          return
        }
        setMime(type)
        const blob = new Blob([data], { type })
        blobRef.current = blob
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)

        if (type.startsWith('image/')) return

        await renderPdfToCanvas(blob, container)
        setPdfReady(true)
      })
      .catch(async (err) => {
        const blob = err.response?.data
        if (blob instanceof Blob) {
          try {
            const j = JSON.parse(await blob.text()) as { error?: string }
            setError(j.error || 'ไม่สามารถโหลดเอกสารได้')
            return
          } catch {
            /* fall through */
          }
        }
        setError('ไม่สามารถโหลดเอกสารได้')
      })
      .finally(() => setLoading(false))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path, ready, jwt])

  useEffect(() => {
    if (!pdfReady || !autoPrint || isImage) return
    const t = setTimeout(() => printDoc(), 800)
    return () => clearTimeout(t)
  }, [pdfReady, autoPrint, isImage])

  function guessMime(apiPath: string) {
    if (/\.png/i.test(apiPath)) return 'image/png'
    if (/\.(jpe?g|webp)/i.test(apiPath)) return 'image/jpeg'
    return 'application/pdf'
  }

  async function renderPdfToCanvas(blob: Blob, container: HTMLDivElement | null) {
    if (!container) return
    container.innerHTML = ''
    const buffer = await blob.arrayBuffer()
    const pdf = await getDocument({ data: buffer }).promise
    const dpr = window.devicePixelRatio || 1
    const scale = Math.min(1.5, (container.clientWidth || 360) / 595)

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.className = 'w-full h-auto bg-white mb-2 shadow-sm block mx-auto'
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      ctx.scale(dpr, dpr)
      await page.render({ canvasContext: ctx, viewport }).promise
      container.appendChild(canvas)
    }
    pdf.destroy()
  }

  function fileExt() {
    if (mime === 'image/png') return 'png'
    if (mime.startsWith('image/')) return 'jpg'
    return 'pdf'
  }

  function receiptPaymentId() {
    return path.match(/^payments\/([^/]+)\/receipt\/pdf/)?.[1]
  }

  async function download() {
    const paymentId = receiptPaymentId()
    if (paymentId) {
      setDownloading(true)
      try {
        const { data } = await api.post<{ url: string }>(`/payments/${paymentId}/receipt/view-token`)
        if (LIFF_ID && liff.isInClient()) {
          liff.openWindow({ url: data.url, external: true })
          return
        }
        window.open(data.url, '_blank')
        return
      } catch {
        /* fall through to blob download */
      } finally {
        setDownloading(false)
      }
    }

    if (!blobRef.current) return
    const blobUrl = URL.createObjectURL(blobRef.current)
    if (LIFF_ID && liff.isInClient()) {
      liff.openWindow({ url: blobUrl, external: true })
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
      return
    }
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${title.replace(/\s+/g, '-')}.${fileExt()}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(blobUrl)
  }

  function printDoc() {
    if (isImage && url) {
      const w = window.open('')
      if (!w) {
        alert('ไม่สามารถพิมพ์ได้ กรุณากดดาวน์โหลดแล้วเปิดจากแอปไฟล์')
        return
      }
      w.document.write(
        `<html><body style="margin:0"><img src="${url}" style="width:100%" onload="window.print();window.close()" /></body></html>`
      )
      w.document.close()
      return
    }
    if (!pdfReady) return
    window.print()
  }

  const showActions = isImage ? !!url : pdfReady

  if (!ready || !jwt) {
    return (
      <div className="flex flex-col h-screen bg-gray-100">
        <TopBar title={title} />
        <p className="flex-1 flex items-center justify-center text-gray-400">กำลังเข้าสู่ระบบ...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pdf-print-root, #pdf-print-root * { visibility: visible !important; }
          #pdf-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          #pdf-print-root canvas {
            box-shadow: none !important;
            margin: 0 !important;
            page-break-after: always;
          }
        }
      `}</style>
      <div className="flex flex-col h-screen bg-gray-100 print:h-auto">
        <TopBar title={title} />
        <div className="flex-1 relative overflow-auto print:overflow-visible">
          {loading && (
            <p className="absolute inset-0 flex items-center justify-center text-gray-400">กำลังโหลด...</p>
          )}
          {error && (
            <p className="absolute inset-0 flex items-center justify-center text-danger px-4 text-center">{error}</p>
          )}
          {url && isImage && <img src={url} alt={title} className="w-full h-auto bg-white" />}
          {isPdf && <div ref={printRootRef} id="pdf-print-root" className="p-2 min-h-[50vh]" />}
        </div>
        {showActions && (
          <div className="p-3 grid grid-cols-2 gap-2 bg-white border-t print:hidden">
            <Button variant="secondary" onClick={download} disabled={downloading}>
              {downloading ? 'กำลังเปิด...' : 'ดาวน์โหลด'}
            </Button>
            <Button variant="secondary" onClick={printDoc}>ปริ้น</Button>
          </div>
        )}
        {!showActions && !loading && (
          <div className="p-3 print:hidden">
            <Button variant="secondary" onClick={() => nav(-1)}>กลับ</Button>
          </div>
        )}
      </div>
    </>
  )
}
