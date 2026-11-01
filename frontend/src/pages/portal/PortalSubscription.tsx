import { useEffect, useRef, useState } from 'react'
import api from '../../lib/axios'
import { baht, bahtExact, thaiDate } from '../../lib/utils'
import { QRCodeSVG } from 'qrcode.react'
import { OWNER_PLAN_LABEL, OwnerPlan } from '../../lib/ownerPlan'

interface SubSummary {
  owner: {
    plan?: OwnerPlan
    permanent?: boolean
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
  } | null
  payment: {
    promptpayNumber: string | null
    qrPayload: string | null
    graceDays: number
    periodDays: number
    monthlyPrice?: number
    yearlyPrice?: number
  }
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'ทดลองใช้', cls: 'bg-info-bg text-info' },
  ACTIVE: { label: 'ใช้งานอยู่', cls: 'bg-ok-bg text-ok-fg' },
  GRACE: { label: 'ผ่อนผัน', cls: 'bg-warn-bg text-warn-fg' },
  SUSPENDED: { label: 'ระงับชั่วคราว', cls: 'bg-danger-bg text-danger' },
  PENDING_SLIP: { label: 'รอชำระ', cls: 'bg-info-bg text-info' },
  UNDER_REVIEW: { label: 'รอตรวจสลิป', cls: 'bg-warn-bg text-warn-fg' },
  APPROVED: { label: 'อนุมัติแล้ว', cls: 'bg-ok-bg text-ok-fg' },
  REJECTED: { label: 'ถูกปฏิเสธ', cls: 'bg-danger-bg text-danger' },
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

  async function createBill() {
    setUploading(true)
    setError(undefined)
    try {
      await api.post('/subscriptions/me/bill')
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'สร้างบิลไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  async function onUpload(file: File) {
    if (!data?.bill) return
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
  if (!data) return <p className="text-muted">กำลังโหลด...</p>

  const { owner, bill, payment } = data
  const permanent = owner.permanent || owner.plan === 'PERMANENT'
  const plan = (owner.plan || 'TRIAL') as OwnerPlan
  const yearly = plan === 'YEARLY'
  const canUpload = Boolean(bill && (bill.status === 'PENDING_SLIP' || bill.status === 'REJECTED'))
  const billStatus = bill ? STATUS_LABEL[bill.status] : undefined
  const monthlyAmount = payment.monthlyPrice ?? (!yearly && bill ? bill.amount : null)
  const yearlyAmount = payment.yearlyPrice ?? (yearly && bill ? bill.amount : null)

  let bannerTitle = ''
  let bannerBody = ''
  let bannerCls = 'bg-warn-bg text-warn-fg'
  if (permanent) {
    bannerTitle = 'บัญชีถาวร ไม่ต้องชำระค่าบริการ'
    bannerBody = 'ตั้งเป็นแบบถาวร จึงไม่มีการออกบิลค่าบริการ'
    bannerCls = 'bg-ok-bg text-ok-fg'
  } else if (owner.subscriptionStatus === 'SUSPENDED') {
    bannerTitle = 'บัญชีถูกระงับ'
    bannerBody = 'ชำระเงินแล้วรออนุมัติ จึงจะแก้ไขข้อมูลได้'
    bannerCls = 'bg-danger-bg text-danger'
  } else if (owner.subscriptionStatus === 'GRACE') {
    bannerTitle = `เลยกำหนดแล้ว${owner.expiresAt ? ` (อ้างอิง ${thaiDate(owner.expiresAt)})` : ''}`
    bannerBody = `ใช้ต่อได้ในช่วงผ่อนผัน ${payment.graceDays} วัน จากนั้นจะเขียนข้อมูลไม่ได้จนกว่าจะชำระ`
  } else if (owner.subscriptionStatus === 'TRIAL') {
    bannerTitle =
      owner.daysLeft === null
        ? 'ยังไม่เริ่มนับวันทดลองใช้'
        : `ทดลองใช้เหลือ ${owner.daysLeft} วัน${owner.expiresAt ? ` (หมด ${thaiDate(owner.expiresAt)})` : ''}`
    bannerBody = `หลังหมดอายุใช้ต่อได้อีก ${payment.graceDays} วัน จากนั้นจะเขียนข้อมูลไม่ได้จนกว่าจะชำระ`
  } else if (owner.daysLeft !== null && owner.daysLeft <= 7) {
    bannerTitle = `เหลือ ${owner.daysLeft} วัน${owner.expiresAt ? ` (หมด ${thaiDate(owner.expiresAt)})` : ''}`
    bannerBody = `หลังหมดอายุใช้ต่อได้อีก ${payment.graceDays} วัน จากนั้นจะเขียนข้อมูลไม่ได้จนกว่าจะชำระ`
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-0.5">
        <h1 className="m-0 font-display text-[28px] font-bold">ค่าบริการ PropFlow</h1>
        <span className="text-sm text-muted">แยกจากค่าเช่าที่ผู้เช่าจ่ายให้คุณ</span>
      </header>

      {bannerTitle && (
        <section className={`rounded-[18px] px-[22px] py-[18px] flex flex-col gap-0.5 ${bannerCls}`}>
          <strong className="text-[17px]">{bannerTitle}</strong>
          <span className="text-sm">{bannerBody}</span>
        </section>
      )}

      <div className="flex flex-wrap gap-4 items-start">
        <section className="min-w-0 flex flex-col gap-4" style={{ flex: '2 1 480px' }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div
              aria-pressed={!yearly}
              className={`rounded-[18px] bg-white p-[22px] text-left flex flex-col gap-1.5 ${yearly ? 'border-[1.5px] border-line-input' : 'border-2 border-primary'}`}
            >
              <span className={`text-sm font-bold ${yearly ? 'text-muted' : 'text-ok-fg'}`}>
                รายเดือน{!yearly ? ' · เลือกอยู่' : ''}
              </span>
              <strong className="font-display text-[34px] pf-amount">
                {monthlyAmount != null ? baht(monthlyAmount) : '—'}
                <span className="text-base font-semibold text-muted"> / {payment.periodDays} วัน</span>
              </strong>
              <span className="text-sm text-muted">ทุกอาคาร ทุกห้อง ไม่จำกัดผู้เช่า</span>
            </div>
            <div
              aria-pressed={yearly}
              className={`rounded-[18px] bg-white p-[22px] text-left flex flex-col gap-1.5 ${yearly ? 'border-2 border-primary' : 'border-[1.5px] border-line-input'}`}
            >
              <span className={`text-sm font-bold ${yearly ? 'text-ok-fg' : 'text-muted'}`}>
                รายปี{yearly ? ' · เลือกอยู่' : ''}
              </span>
              <strong className="font-display text-[34px] pf-amount">
                {yearlyAmount != null ? baht(yearlyAmount) : '—'}
                <span className="text-base font-semibold text-muted"> / 365 วัน</span>
              </strong>
              <span className="text-sm text-muted">
                {yearly ? OWNER_PLAN_LABEL.YEARLY : `ชำระครั้งเดียว ใช้ได้ ${365} วัน`}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3">
            <h2 className="m-0 font-display text-lg font-semibold">ประวัติการชำระ</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-muted text-[13px]">
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">เลขบิล</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">ช่วง</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold text-right">ยอด</th>
                    <th className="px-3 py-2.5 border-b border-line-input font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {bill ? (
                    <tr>
                      <td className="p-3 border-b border-line-soft font-bold">{bill.billNo}</td>
                      <td className="p-3 border-b border-line-soft">{bill.periodDays} วัน</td>
                      <td className="p-3 border-b border-line-soft text-right">{bahtExact(bill.amount)}</td>
                      <td className="p-3 border-b border-line-soft">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${billStatus?.cls || ''}`}>{billStatus?.label || bill.status}</span>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td className="p-3 text-muted" colSpan={4}>
                        ยังไม่มีบิลค่าบริการ
                      </td>
                    </tr>
                  )}
                  {owner.subscriptionStatus === 'TRIAL' && (
                    <tr>
                      <td className="p-3 text-muted" colSpan={4}>
                        ยังไม่มีประวัติก่อนหน้า (อยู่ในช่วงทดลองใช้)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {bill?.rejectReason && <p className="m-0 text-sm text-danger">เหตุผล: {bill.rejectReason}</p>}
          </div>
        </section>

        {!permanent && (
          <aside className="min-w-0 bg-white rounded-[18px] p-[22px] flex flex-col gap-3.5" style={{ flex: '1 1 300px' }}>
            <strong className="font-display text-lg">{bill ? `ชำระบิล ${bill.billNo}` : 'ยังไม่มีบิลเปิดอยู่'}</strong>
            {bill && payment.qrPayload && canUpload && (
              <div className="self-center w-[200px] h-[200px] rounded-[14px] border border-line-input bg-white flex items-center justify-center" role="img" aria-label="QR PromptPay ของแพลตฟอร์ม">
                <QRCodeSVG value={payment.qrPayload} size={180} />
              </div>
            )}
            {bill && !payment.promptpayNumber && canUpload && (
              <p className="m-0 text-sm text-warn-fg">ยังไม่ได้ตั้งเลข PromptPay ของแพลตฟอร์ม — ติดต่อแอดมิน</p>
            )}
            {bill && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">ยอด</span>
                <strong>{bahtExact(bill.amount)}</strong>
              </div>
            )}
            {canUpload && (
              <>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const f = e.dataTransfer.files?.[0]
                    if (f) void onUpload(f)
                  }}
                  className="h-24 rounded-xl border-[1.5px] border-dashed border-placeholder bg-white flex flex-col items-center justify-center gap-1 text-primary text-[15px] font-bold"
                >
                  ลากสลิปมาวางที่นี่
                  <span className="text-xs font-normal text-muted">หรือคลิกเพื่อเลือกไฟล์</span>
                </button>
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
                <button type="button" disabled={uploading} className="h-11 border-0 rounded-xl bg-primary text-white font-sans text-base font-bold disabled:opacity-50" onClick={() => fileRef.current?.click()}>
                  {uploading ? 'กำลังอัปโหลด...' : 'ส่งสลิปให้แอดมินตรวจ'}
                </button>
              </>
            )}
            {!bill && (
              <button type="button" disabled={uploading} onClick={createBill} className="h-11 border-0 rounded-xl bg-primary text-white font-sans text-base font-bold disabled:opacity-50">
                {uploading ? 'กำลังสร้าง...' : 'สร้างบิลชำระล่วงหน้า'}
              </button>
            )}
            {bill?.status === 'UNDER_REVIEW' && <p className="m-0 text-sm text-warn-fg text-center">รอแอดมินตรวจสอบสลิป</p>}
            {msg && <p className="m-0 text-sm text-ok-fg text-center">{msg}</p>}
            {error && <p className="m-0 text-sm text-danger text-center">{error}</p>}
          </aside>
        )}
      </div>
    </div>
  )
}
