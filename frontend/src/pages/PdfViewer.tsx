import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/axios'
import { Button } from '../components/ui'
import { TopBar } from '../components/layout/TopBar'

/** LIFF in-app browser blocks window.open(blob:…). Load documents in-page instead. */
export default function PdfViewer() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const path = params.get('path') || ''
  const title = params.get('title') || 'เอกสาร'
  const autoPrint = params.get('print') === '1'
  const [url, setUrl] = useState<string>()
  const [mime, setMime] = useState('application/pdf')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  const isImage = mime.startsWith('image/')

  useEffect(() => {
    if (!path) {
      setError('ไม่พบเอกสาร')
      setLoading(false)
      return
    }
    let objectUrl: string | undefined
    api
      .get(`/${path.replace(/^\//, '')}`, { responseType: 'blob' })
      .then(({ data }) => {
        const type = data.type || 'application/pdf'
        setMime(type)
        objectUrl = URL.createObjectURL(new Blob([data], { type }))
        setUrl(objectUrl)
      })
      .catch(() => setError('ไม่สามารถโหลดเอกสารได้'))
      .finally(() => setLoading(false))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  useEffect(() => {
    if (!url || !autoPrint || isImage) return
    const t = setTimeout(() => {
      try {
        iframeRef.current?.contentWindow?.focus()
        iframeRef.current?.contentWindow?.print()
      } catch {
        /* print may be blocked — user can tap ปริ้น */
      }
    }, 800)
    return () => clearTimeout(t)
  }, [url, autoPrint, isImage])

  function fileExt() {
    if (mime === 'image/png') return 'png'
    if (mime.startsWith('image/')) return 'jpg'
    return 'pdf'
  }

  function download() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '-')}.${fileExt()}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function printDoc() {
    if (!url) return
    if (isImage) {
      const w = window.open('')
      if (!w) {
        alert('ไม่สามารถพิมพ์ได้ กรุณาบันทึกไฟล์แล้วเปิดจากแอปไฟล์')
        return
      }
      w.document.write(`<html><body style="margin:0"><img src="${url}" style="width:100%" onload="window.print();window.close()" /></body></html>`)
      w.document.close()
      return
    }
    try {
      iframeRef.current?.contentWindow?.focus()
      iframeRef.current?.contentWindow?.print()
    } catch {
      alert('ไม่สามารถพิมพ์ได้ กรุณาบันทึก PDF แล้วเปิดจากแอปไฟล์')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <TopBar title={title} />
      <div className="flex-1 relative overflow-auto">
        {loading && <p className="absolute inset-0 flex items-center justify-center text-gray-400">กำลังโหลด...</p>}
        {error && <p className="absolute inset-0 flex items-center justify-center text-danger px-4 text-center">{error}</p>}
        {url && isImage && (
          <img src={url} alt={title} className="w-full h-auto bg-white" />
        )}
        {url && !isImage && (
          <iframe
            ref={iframeRef}
            src={url}
            title={title}
            className="w-full h-full border-0 bg-white min-h-[70vh]"
          />
        )}
      </div>
      {url && (
        <div className="p-3 grid grid-cols-2 gap-2 bg-white border-t">
          <Button variant="secondary" onClick={download}>ดาวน์โหลด</Button>
          <Button variant="secondary" onClick={printDoc}>ปริ้น</Button>
        </div>
      )}
      {!url && !loading && (
        <div className="p-3">
          <Button variant="secondary" onClick={() => nav(-1)}>กลับ</Button>
        </div>
      )}
    </div>
  )
}
