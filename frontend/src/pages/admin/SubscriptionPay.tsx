import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { baht, cls, thaiDate } from '../../lib/utils'
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
  payment: { promptpayNumber: string | null; qrPayload: string | null; graceDays: number }
}

const STATUS: Record<string, { label: string; cls: string }> = {
  TRIAL: { label: 'ทดลองใช้', cls: 'bg-info-bg text-info' },
  ACTIVE: { label: 'ใช้งาน', cls: 'bg-ok-bg text-ok-fg' },
  GRACE: { label: 'ผ่อนผัน', cls: 'bg-warn-bg text-warn-fg' },
  SUSPENDED: { label: 'ระงับ', cls: 'bg-danger-bg text-danger' },
}

export default function SubscriptionPay() {
  const [data, setData] = useState<SubSummary>()
  const [error, setError] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<string>()
  const [file, setFile] = useState<File>()
  const fileRef = useRef<HTMLInputElement>(null)
  const [yearly, setYearly] = useState(false)

  function load() {
    api.get('/subscriptions/me').then((r) => {
      setData(r.data)
      setYearly((r.data.owner.plan || '') === 'YEARLY' || (r.data.bill?.periodDays || 0) >= 360)
    }).catch(() => setError('โหลดข้อมูลสมาชิกไม่สำเร็จ'))
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
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof m === 'string' ? m : 'สร้างบิลไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  async function onUpload() {
    if (!data?.bill || !file) return
    setUploading(true)
    setMsg(undefined)
    setError(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/subscriptions/${data.bill.id}/slip`, fd)
      setMsg('ส่งสลิปแล้ว รอแอดมินตรวจสอบ')
      setFile(undefined)
      load()
    } catch (e: unknown) {
      const m = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof m === 'string' ? m : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  if (!data && !error) {
    return (
      <div>
        <TopBar title="ค่าบริการ PropFlow" />
        <div className="p-4"><div className="h-28 rounded-[18px] bg-surface-2" /></div>
      </div>
    )
  }
  if (error && !data) {
    return (
      <div>
        <TopBar title="ค่าบริการ PropFlow" />
        <p className="p-4 text-danger">{error}</p>
      </div>
    )
  }
  if (!data) return null

  const { owner, bill, payment } = data
  const permanent = owner.permanent || owner.plan === 'PERMANENT'
  const canUpload = Boolean(bill && (bill.status === 'PENDING_SLIP' || bill.status === 'REJECTED'))
  const st = STATUS[owner.subscriptionStatus] || { label: owner.subscriptionStatus, cls: 'bg-neutral-bg text-ink-2' }
  const amountLabel = bill ? baht(bill.amount) : null

  return (
    <div className="pb-28">
      <TopBar title="ค่าบริการ PropFlow" />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <strong className="text-[15px]">สถานะ</strong>
            <span className={cls('px-2.5 py-1 rounded-full text-[13px] font-bold', st.cls)}>{st.label}</span>
          </div>
          <div className="flex gap-1" aria-label="ไทม์ไลน์">
            <Bar flex="flex-[14]" color="bg-info" label="ทดลอง" />
            <Bar flex="flex-[7]" color="bg-warn-chart" label="ผ่อนผัน" />
            <Bar flex="flex-[5]" color="bg-danger" label="ระงับ" />
          </div>
          <span className="text-[13px] leading-relaxed text-ink-2">
            {permanent
              ? 'บัญชีนี้เป็นแบบถาวร จึงไม่มีการออกบิลค่าบริการ'
              : owner.expiresAt
                ? `หมดอายุ ${thaiDate(owner.expiresAt)}${owner.daysLeft != null ? ` · เหลือ ${owner.daysLeft} วัน` : ''}${payment.graceDays ? ` · ผ่อนผัน ${payment.graceDays} วัน` : ''}`
                : 'ยังไม่เริ่มทดลองใช้'}
            {owner.writeBlocked ? ' ระบบเปิดให้ดูข้อมูลได้อย่างเดียว' : ''}
          </span>
          <span className="text-xs text-muted">แพ็กเกจ {OWNER_PLAN_LABEL[(owner.plan || 'TRIAL') as OwnerPlan]}</span>
        </section>

        {!permanent && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              aria-pressed={!yearly}
              className={cls('rounded-card p-3.5 text-left flex flex-col gap-0.5', !yearly ? 'border-2 border-primary bg-primary-soft' : 'border-[1.5px] border-line-soft bg-white')}
              onClick={() => setYearly(false)}
            >
              <span className={cls('text-[13px] font-bold', !yearly ? 'text-ok-fg' : 'text-muted')}>รายเดือน</span>
              <strong className="font-display text-2xl">{!yearly && amountLabel ? amountLabel : 'ตามบิล'}</strong>
              <span className="text-xs text-muted">ต่ออายุ {bill && !yearly ? `${bill.periodDays} วัน` : '30 วัน'}</span>
            </button>
            <button
              type="button"
              aria-pressed={yearly}
              className={cls('rounded-card p-3.5 text-left flex flex-col gap-0.5', yearly ? 'border-2 border-primary bg-primary-soft' : 'border-[1.5px] border-line-soft bg-white')}
              onClick={() => setYearly(true)}
            >
              <span className={cls('text-[13px] font-bold', yearly ? 'text-ok-fg' : 'text-muted')}>รายปี</span>
              <strong className="font-display text-2xl">{yearly && amountLabel ? amountLabel : 'ตามบิล'}</strong>
              <span className="text-xs text-muted">ต่ออายุ 365 วัน</span>
            </button>
          </div>
        )}

        {!permanent && bill && (
          <section className="bg-white rounded-[18px] p-4 flex items-center gap-3.5">
            <div className="w-[104px] h-[104px] shrink-0 rounded-button border border-line-soft bg-white flex items-center justify-center" role="img" aria-label="QR PromptPay ของแพลตฟอร์ม">
              {payment.qrPayload && canUpload ? <QRCodeSVG value={payment.qrPayload} size={92} /> : <span className="text-xs text-muted text-center px-2">QR</span>}
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs text-muted">บิล {bill.billNo}</span>
              <strong className="text-[15px]">สแกนจ่าย แล้วแนบสลิป</strong>
              <span className="text-xs text-muted">ยอด {baht(bill.amount)} · แอดมินตรวจภายใน 1 วันทำการ แจ้งผลทาง LINE</span>
              {bill.rejectReason && <span className="text-xs text-danger">เหตุผล: {bill.rejectReason}</span>}
              {bill.status === 'UNDER_REVIEW' && <span className="text-xs text-warn-fg">รอแอดมินตรวจสอบสลิป</span>}
            </div>
          </section>
        )}

        {!permanent && !bill && (
          <p className="text-sm text-muted">ยังไม่มีบิลค่าบริการ — สร้างบิลเมื่อต้องการต่ออายุ</p>
        )}
        {!payment.promptpayNumber && canUpload && <p className="text-sm text-warn-fg">ยังไม่ได้ตั้งเลข PromptPay ของแพลตฟอร์ม</p>}

        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <button type="button" className="h-14 rounded-[14px] border-[1.5px] border-dashed border-placeholder bg-white text-primary text-[15px] font-bold" onClick={() => fileRef.current?.click()}>
              {file ? file.name : 'แนบสลิปการโอน'}
            </button>
          </>
        )}
        {msg && <p className="text-sm text-ok-fg text-center">{msg}</p>}
        {error && data && <p className="text-sm text-danger text-center">{error}</p>}
      </div>

      {!permanent && (
        <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6">
          {canUpload ? (
            <button type="button" className="w-full h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold disabled:opacity-50" disabled={uploading || !file} onClick={onUpload}>
              {uploading ? 'กำลังส่ง...' : 'ส่งสลิปค่าบริการ'}
            </button>
          ) : !bill ? (
            <button type="button" className="w-full h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold disabled:opacity-50" disabled={uploading} onClick={createBill}>
              {uploading ? 'กำลังสร้าง...' : 'สร้างบิลชำระ'}
            </button>
          ) : (
            <p className="text-center text-sm text-muted py-3">สถานะบิล: {bill.status === 'UNDER_REVIEW' ? 'รอตรวจ' : bill.status === 'APPROVED' ? 'อนุมัติแล้ว' : bill.status}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Bar({ flex, color, label }: { flex: string; color: string; label: string }) {
  return (
    <div className={`${flex} flex flex-col gap-1`}>
      <span className={`h-1.5 rounded ${color}`} />
      <span className="text-[11px] text-muted">{label}</span>
    </div>
  )
}
