import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../lib/axios'
import { Button, Card } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht } from '../../lib/utils'

export default function PaymentQR() {
  const { invoiceId } = useParams()
  const nav = useNavigate()
  const [qr, setQr] = useState<{ payload: string; amount: number; promptpayNumber: string }>()
  const [seconds, setSeconds] = useState(30 * 60)
  const [file, setFile] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get(`/payments/${invoiceId}/qr`).then((r) => setQr(r.data)).catch(() => setError('ไม่สามารถสร้าง QR ได้'))
  }, [invoiceId])

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  async function submit() {
    if (!file) return
    setUploading(true)
    setError(undefined)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/payments/${invoiceId}/slip`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      nav(`/payment/${invoiceId}/success`, { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'อัปโหลดไม่สำเร็จ')
      setUploading(false)
    }
  }

  return (
    <div>
      <TopBar title="สแกนเพื่อชำระเงิน" />
      <div className="p-4 space-y-4">
        {error && <p className="text-danger text-sm text-center">{error}</p>}
        <Card className="text-center">
          {qr ? (
            <>
              <div className="bg-white inline-block p-3 rounded-xl border border-gray-100">
                <QRCodeSVG value={qr.payload} size={200} />
              </div>
              <div className="text-2xl font-bold text-line mt-3">{baht(qr.amount)}</div>
              <p className="text-sm text-gray-400">พร้อมเพย์ {qr.promptpayNumber}</p>
              <p className="text-xs text-amber mt-2">QR หมดอายุใน {mm}:{ss}</p>
            </>
          ) : (
            <p className="text-gray-400 py-10">กำลังสร้าง QR...</p>
          )}
        </Card>

        <Card>
          <h4 className="font-semibold mb-2">แนบสลิปการโอน</h4>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          {preview ? (
            <div className="space-y-3">
              <img src={preview} className="w-full rounded-xl" />
              <Button onClick={submit} disabled={uploading}>{uploading ? 'กำลังส่ง...' : 'ส่งสลิป'}</Button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-400"
            >
              📷 เลือกรูปสลิป
            </button>
          )}
        </Card>
      </div>
    </div>
  )
}
