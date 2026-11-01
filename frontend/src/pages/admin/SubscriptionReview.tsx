import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { baht, cls, thaiDate, thaiDateTime } from '../../lib/utils'

interface SubPayment {
  id: string
  billNo: string
  amount: number
  periodDays: number
  status: string
  slipUploadedAt?: string
  rejectReason?: string
  extendsTo?: string
  createdAt: string
  owner: { id: string; name: string; subscriptionStatus: string; expiresAt?: string }
}

type Tab = 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'

export default function SubscriptionReview() {
  const [items, setItems] = useState<SubPayment[]>([])
  const [error, setError] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [tab, setTab] = useState<Tab>('UNDER_REVIEW')
  const [slips, setSlips] = useState<Record<string, string>>({})
  const [zoom, setZoom] = useState<string>()

  function load() {
    api.get('/subscriptions').then((r) => setItems(r.data)).catch(() => setError('โหลดรายการไม่สำเร็จ'))
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const pending = items.filter((i) => i.status === 'UNDER_REVIEW')
    let cancelled = false
    pending.forEach(async (p) => {
      if (slips[p.id]) return
      try {
        const res = await api.get(`/subscriptions/${p.id}/slip`, { responseType: 'blob' })
        if (cancelled) return
        const url = URL.createObjectURL(res.data)
        setSlips((s) => ({ ...s, [p.id]: url }))
      } catch {
        /* slip optional */
      }
    })
    return () => {
      cancelled = true
    }
    // slips updated inside; only reload when the pending set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function approve(id: string) {
    setBusyId(id)
    try {
      await api.post(`/subscriptions/${id}/approve`)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(typeof msg === 'string' ? msg : 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusyId(undefined)
    }
  }

  async function reject(id: string) {
    const reason = prompt('เหตุผลที่ปฏิเสธ', 'สลิปไม่ถูกต้อง') || undefined
    setBusyId(id)
    try {
      await api.post(`/subscriptions/${id}/reject`, { reason })
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(typeof msg === 'string' ? msg : 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusyId(undefined)
    }
  }

  const pendingN = items.filter((i) => i.status === 'UNDER_REVIEW').length
  const rows = items.filter((i) => i.status === tab)

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 pb-3 flex flex-col gap-3">
        <h1 className="m-0 font-display text-[26px] font-bold">ค่าบริการ</h1>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div role="tablist" className="grid grid-cols-3 gap-1 p-1 rounded-button bg-segment">
          {(
            [
              ['UNDER_REVIEW', `รอตรวจ ${pendingN}`],
              ['APPROVED', 'อนุมัติแล้ว'],
              ['REJECTED', 'ปฏิเสธ'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={cls('h-9 rounded-[9px] text-sm', tab === key ? 'bg-white font-bold' : 'font-semibold text-muted')}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {rows.length === 0 && <p className="text-sm text-muted text-center py-6">ไม่มีรายการ</p>}
        {rows.map((s) => {
          const plan = s.periodDays >= 360 ? 'รายปี' : 'รายเดือน'
          const until = s.extendsTo ? thaiDate(s.extendsTo) : s.owner.expiresAt ? thaiDate(s.owner.expiresAt) : '-'
          return (
            <article key={s.id} className="bg-white rounded-[18px] p-3.5 flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="w-[72px] h-[100px] shrink-0 rounded-[10px] bg-surface-2 border border-line-soft overflow-hidden flex items-center justify-center"
                  aria-label="รูปสลิป"
                  onClick={() => slips[s.id] && setZoom(slips[s.id])}
                >
                  {slips[s.id] ? <img src={slips[s.id]} alt="" className="w-full h-full object-cover" /> : <span className="text-[11px] text-muted">สลิป</span>}
                </button>
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <strong className="text-base truncate">{s.owner.name}</strong>
                  <span className="text-[13px] text-muted">{s.billNo} · {plan}</span>
                  <span className="text-[13px] text-muted">ส่ง {thaiDateTime(s.slipUploadedAt || s.createdAt)}</span>
                  <span className={cls('self-start px-2.5 py-0.5 rounded-full text-xs font-bold', s.status === 'REJECTED' ? 'bg-danger-bg text-danger' : 'bg-warn-bg text-warn-fg')}>
                    {s.rejectReason || (s.status === 'UNDER_REVIEW' ? 'รอตรวจสลิป' : s.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธ')}
                  </span>
                </div>
                <strong className="font-display text-lg">{baht(s.amount)}</strong>
              </div>
              {tab === 'UNDER_REVIEW' && (
                <>
                  <span className="text-[13px] text-ink-2">อนุมัติแล้วจะต่ออายุถึง <strong>{until}</strong></span>
                  <div className="grid grid-cols-[1fr_1.6fr] gap-2">
                    <button type="button" className="h-11 rounded-button bg-danger-bg text-danger text-[15px] font-bold disabled:opacity-50" disabled={busyId === s.id} onClick={() => reject(s.id)}>
                      ปฏิเสธ
                    </button>
                    <button type="button" className="h-11 rounded-button bg-primary text-white text-[15px] font-bold disabled:opacity-50" disabled={busyId === s.id} onClick={() => approve(s.id)}>
                      อนุมัติ
                    </button>
                  </div>
                </>
              )}
            </article>
          )
        })}
      </div>
      <BottomNav role="ADMIN" />
      {zoom && (
        <button type="button" className="fixed inset-0 z-40 bg-ink/80 flex items-center justify-center p-4" onClick={() => setZoom(undefined)} aria-label="ปิดรูป">
          <img src={zoom} alt="สลิป" className="max-h-[90vh] max-w-full rounded-card" />
        </button>
      )}
    </div>
  )
}
