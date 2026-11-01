import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { closeLiff } from '../../lib/liff'
import { bahtExact, thaiDateTime, thaiMonth } from '../../lib/utils'

interface PayState {
  total?: number
  billsLabel?: string
  sentAt?: string
}

const TYPE_TH: Record<string, string> = { RENT: 'ค่าเช่า', UTILITY: 'ค่าน้ำไฟ', SHORTFALL: 'ส่วนต่าง' }

export default function PaymentSuccess() {
  const { invoiceId } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const passed = (loc.state || {}) as PayState
  const [total, setTotal] = useState<number | undefined>(passed.total)
  const [label, setLabel] = useState(passed.billsLabel || '')
  const [sentAt, setSentAt] = useState(passed.sentAt || '')
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    if (!invoiceId || invoiceId === 'done') return
    api
      .get(`/invoices/${invoiceId}`)
      .then((r) => {
        const inv = r.data
        if (total == null) setTotal(Number(inv.total))
        if (!label) setLabel(`${TYPE_TH[inv.type || 'RENT'] || 'บิล'} ${thaiMonth(inv.month)}`)
        if (!sentAt && inv.payment?.slipUploadedAt) setSentAt(inv.payment.slipUploadedAt)
        if (inv.status === 'PAID' || inv.payment?.status === 'APPROVED') setApproved(true)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  const steps = [
    { label: 'ส่งสลิปแล้ว', hint: sentAt ? thaiDateTime(sentAt) : 'เมื่อสักครู่', state: 'done' as const },
    {
      label: approved ? 'เจ้าของตรวจแล้ว' : 'เจ้าของกำลังตรวจ',
      hint: approved ? 'อนุมัติแล้ว' : 'แจ้งเจ้าของทาง LINE แล้ว',
      state: approved ? ('done' as const) : ('current' as const),
    },
    {
      label: 'ได้รับใบเสร็จ PDF',
      hint: 'ส่งเข้าแชทและหน้าเอกสาร',
      state: approved ? ('done' as const) : ('todo' as const),
    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <div className="flex-1 px-5 pt-12 pb-4 flex flex-col gap-[22px]">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <div className="w-[88px] h-[88px] rounded-full bg-primary-soft flex items-center justify-center">
            <div className="w-[60px] h-[60px] rounded-full bg-brand flex items-center justify-center text-ink">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12 5 5 9-10" />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-[26px] font-bold m-0">ส่งสลิปเรียบร้อย</h1>
          <p className="m-0 text-base leading-relaxed text-muted">
            เจ้าของจะตรวจและส่งใบเสร็จเข้า LINE ให้คุณ
            <br />
            ปกติภายในวันนี้
          </p>
        </div>

        <section className="bg-white rounded-hero p-[18px] flex flex-col gap-2.5">
          <Row k="ยอดที่แจ้ง" v={<strong className="pf-amount text-sm">{total != null ? bahtExact(total) : '—'}</strong>} />
          <Row k="บิล" v={<span>{label || '—'}</span>} />
          <Row k="ส่งเมื่อ" v={<span>{sentAt ? thaiDateTime(sentAt) : 'เมื่อสักครู่'}</span>} />
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted">สถานะ</span>
            <span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${approved ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`}>
              {approved ? 'ชำระแล้ว' : 'รอตรวจสลิป'}
            </span>
          </div>
        </section>

        <section className="bg-white rounded-hero p-[18px] flex flex-col">
          <strong className="text-[15px] mb-3.5">ติดตามสถานะ</strong>
          {steps.map((s, i) => (
            <div key={s.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`w-[22px] h-[22px] rounded-full box-border flex items-center justify-center ${
                    s.state === 'done'
                      ? 'bg-primary'
                      : s.state === 'current'
                        ? 'border-[3px] border-warn-fg bg-white'
                        : 'border-2 border-line-input bg-white'
                  }`}
                >
                  {s.state === 'done' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="m5 12 5 5 9-10" />
                    </svg>
                  )}
                </span>
                {i < steps.length - 1 && (
                  <span className={`w-0.5 h-[30px] ${s.state === 'done' && steps[i + 1].state !== 'todo' ? 'bg-primary' : s.state === 'done' ? 'bg-primary' : 'bg-[#DCE3DF]'}`} />
                )}
              </div>
              <div className="flex flex-col gap-0.5 pt-px pb-2">
                <strong className={`text-sm ${s.state === 'current' ? 'text-warn-fg' : s.state === 'todo' ? 'text-muted' : 'text-ink'}`}>{s.label}</strong>
                <span className="text-[13px] text-muted">{s.hint}</span>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="px-4 pt-3 pb-6 flex flex-col gap-2">
        <button type="button" onClick={() => closeLiff()} className="h-[52px] rounded-cta bg-primary text-white font-bold text-[17px]">
          กลับไปที่แชท LINE
        </button>
        <button type="button" onClick={() => nav('/tenant/home')} className="h-11 rounded-cta text-primary font-bold text-[15px]">
          ไปหน้าหลัก
        </button>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      {v}
    </div>
  )
}
