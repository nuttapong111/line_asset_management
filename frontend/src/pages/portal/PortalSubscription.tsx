import { useEffect, useRef, useState } from 'react'
import api from '../../lib/axios'
import { baht, thaiDate } from '../../lib/utils'
import { Button } from '../../components/ui'
import { QRCodeSVG } from 'qrcode.react'

interface SubSummary {
  owner: {
    subscriptionStatus: string
    expiresAt?: string
    daysLeft: number | null
    writeBlocked: boolean
  }
  bill: {
    id: string
    billNo: string
    amount: number
    periodDays: number
    status: string
    rejectReason?: string
  }
  payment: {
    promptpayNumber: string | null
    qrPayload: string | null
    graceDays: number
  }
}

const STATUS_LABEL: Record<string, string> = {
  TRIAL: 'ทดลองใช้',
  ACTIVE: 'ใช้งานอยู่',
  GRACE: 'หมดอายุแล้ว (ผ่อนผัน)',
  SUSPENDED: 'ระงับชั่วคราว',
  PENDING_SLIP: 'รอชำระ',
  UNDER_REVIEW: 'รอตรวจสลิป',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
}

export default function PortalSubscription() {
  const [data, setData] = useState<SubSummary>()
  const [error, setError] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  function load() {
    api
      .get('/subscriptions/me')
      .then((r) => setData(r.data))
      .catch(() => setError('โหลดข้อมูลสมาชิกไม่สำเร็จ'))
  }

  useEffect(() => {
    load()
  }, [])

  async function onUpload(file: File) {
    if (!data) return
    setUploading(true)
    setMsg(undefined)
    setError(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/subscriptions/${data.bill.id}/slip`, fd)
      setMsg('ส่งสลิปแล้ว รอแอดมินตรวจสอบ')
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  if (error && !data) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-gray-400">กำลังโหลด...</p>

  const { owner, bill, payment } = data
  const canUpload = bill.status === 'PENDING_SLIP' || bill.status === 'REJECTED'

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">ค่าบริการ PropFlow</h1>
        <p className="text-sm text-gray-500 mt-1">ชำระเพื่อต่ออายุการใช้งานระบบ</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">สถานะ</span>
          <span className="font-semibold">{STATUS_LABEL[owner.subscriptionStatus] || owner.subscriptionStatus}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">หมดอายุ</span>
          <span>{thaiDate(owner.expiresAt)}</span>
        </div>
        {owner.daysLeft !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">เหลือ</span>
            <span className={owner.daysLeft <= 3 ? 'text-danger font-semibold' : ''}>
              {owner.daysLeft >= 0 ? `${owner.daysLeft} วัน` : `เลยมา ${Math.abs(owner.daysLeft)} วัน`}
            </span>
          </div>
        )}
        {owner.writeBlocked && (
          <p className="text-sm text-danger bg-red-50 rounded-lg p-2 mt-2">
            บัญชีถูกระงับ — ชำระเงินแล้วรออนุมัติ จึงจะแก้ไขข้อมูลได้
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h2 className="font-semibold">ใบแจ้งหนี้ {bill.billNo}</h2>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">ยอดชำระ</span>
          <span className="text-xl font-bold text-line">{baht(bill.amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">ระยะเวลา</span>
          <span>{bill.periodDays} วัน</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">สถานะบิล</span>
          <span>{STATUS_LABEL[bill.status] || bill.status}</span>
        </div>
        {bill.rejectReason && <p className="text-sm text-danger">เหตุผล: {bill.rejectReason}</p>}

        {payment.qrPayload && canUpload && (
          <div className="flex flex-col items-center gap-2 py-3">
            <QRCodeSVG value={payment.qrPayload} size={180} />
            <p className="text-xs text-gray-400">PromptPay {payment.promptpayNumber}</p>
          </div>
        )}
        {!payment.promptpayNumber && canUpload && (
          <p className="text-sm text-amber-600">ยังไม่ได้ตั้งเลข PromptPay ของแพลตฟอร์ม — ติดต่อแอดมิน</p>
        )}

        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onUpload(f)
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'กำลังอัปโหลด...' : 'แนบสลิปการชำระ'}
            </Button>
          </>
        )}
        {bill.status === 'UNDER_REVIEW' && (
          <p className="text-sm text-amber-600 text-center">รอแอดมินตรวจสอบสลิป</p>
        )}
        {msg && <p className="text-sm text-line text-center">{msg}</p>}
        {error && <p className="text-sm text-danger text-center">{error}</p>}
      </section>
    </div>
  )
}
