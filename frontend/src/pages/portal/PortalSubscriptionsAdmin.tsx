import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { baht, bahtExact, thaiDate, thaiDateTime } from '../../lib/utils'

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

const STATUS: Record<string, string> = {
  PENDING_SLIP: 'รอชำระ',
  UNDER_REVIEW: 'รอตรวจ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ปฏิเสธ',
  TRIAL: 'ทดลองใช้',
  ACTIVE: 'ใช้งานอยู่',
  GRACE: 'ผ่อนผัน',
  SUSPENDED: 'ระงับ',
}

export default function PortalSubscriptionsAdmin() {
  const [items, setItems] = useState<SubPayment[]>([])
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [slipUrl, setSlipUrl] = useState<string>()
  const [reason, setReason] = useState('')

  function load() {
    api
      .get('/subscriptions')
      .then((r) => {
        const list = r.data as SubPayment[]
        setItems(list)
        setSelectedId((cur) => {
          if (cur && list.some((i) => i.id === cur)) return cur
          return list.find((i) => i.status === 'UNDER_REVIEW')?.id || list[0]?.id
        })
      })
      .catch(() => setError('โหลดรายการไม่สำเร็จ'))
  }

  useEffect(() => {
    load()
  }, [])

  const pending = items.filter((i) => i.status === 'UNDER_REVIEW')
  const selected = items.find((i) => i.id === selectedId) || pending[0]
  const others = items.filter((i) => i.status !== 'UNDER_REVIEW')

  useEffect(() => {
    if (!selected || selected.status === 'PENDING_SLIP') {
      setSlipUrl(undefined)
      return
    }
    let revoked = false
    let objectUrl: string | undefined
    api
      .get(`/subscriptions/${selected.id}/slip`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data)
        if (revoked) URL.revokeObjectURL(objectUrl)
        else setSlipUrl(objectUrl)
      })
      .catch(() => {
        if (!revoked) setSlipUrl(undefined)
      })
    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selected?.id, selected?.status])

  async function approve() {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/subscriptions/${selected.id}/approve`)
      setReason('')
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/subscriptions/${selected.id}/reject`, { reason: reason.trim() || undefined })
      setReason('')
      load()
    } catch (e: any) {
      setError(e.response?.data?.error || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const now = new Date()
  const approvedThisMonth = items.filter((i) => {
    if (i.status !== 'APPROVED') return false
    const d = new Date(i.createdAt)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  const graceDays =
    selected?.owner.subscriptionStatus === 'GRACE' && selected.owner.expiresAt
      ? Math.ceil((new Date(selected.owner.expiresAt).getTime() - Date.now()) / 86400000)
      : null

  const canAct = selected?.status === 'UNDER_REVIEW'

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-col gap-0.5">
        <h1 className="m-0 font-display text-[28px] font-bold">ตรวจสลิปค่าบริการ</h1>
        <span className="text-sm text-muted">
          รอตรวจ {pending.length} · อนุมัติแล้วเดือนนี้ {approvedThisMonth}
        </span>
      </header>
      {error && <p className="m-0 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-4 items-start">
        <section aria-label="คิวรอตรวจ" className="min-w-0 bg-white rounded-[18px] overflow-hidden" style={{ flex: '1 1 260px' }}>
          {pending.length === 0 && <p className="p-4 text-sm text-muted m-0">ไม่มีรายการรอตรวจ</p>}
          {pending.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedId(q.id)}
              className={`w-full text-left px-4 py-3.5 border-0 border-b border-line-soft font-sans text-ink flex flex-col gap-0.5 ${selected?.id === q.id ? 'bg-primary-soft' : 'bg-white'}`}
            >
              <div className="flex justify-between">
                <strong className="text-[15px]">{q.owner.name}</strong>
                <strong>{baht(q.amount)}</strong>
              </div>
              <span className="text-xs text-muted">
                {q.billNo} · ส่ง {thaiDateTime(q.slipUploadedAt || q.createdAt)}
              </span>
            </button>
          ))}
        </section>

        <section className="min-w-0 bg-white rounded-[18px] p-5 flex justify-center" style={{ flex: '2 1 380px' }}>
          {slipUrl ? (
            <img src={slipUrl} alt="รูปสลิป" className="w-[300px] max-w-full max-h-[520px] object-contain rounded-[14px] border border-line-input bg-surface-2" />
          ) : (
            <div role="img" aria-label="ไม่มีรูปสลิป" className="w-[300px] h-[320px] max-w-full rounded-[14px] bg-surface-2 border border-line-input flex items-center justify-center text-sm text-muted">
              {selected ? 'ไม่มีรูปสลิป' : 'เลือกบิลจากคิว'}
            </div>
          )}
        </section>

        <aside className="min-w-0 bg-white rounded-[18px] p-5 flex flex-col gap-3" style={{ flex: '1 1 300px' }}>
          {!selected && <p className="m-0 text-sm text-muted">ไม่มีบิลให้ตรวจ</p>}
          {selected && (
            <>
              <strong className="font-display text-lg">{selected.owner.name}</strong>
              <Fact k="บิล" v={selected.billNo} />
              <Fact k="แพ็กเกจ" v={`${selected.periodDays >= 300 ? 'รายปี' : 'รายเดือน'} ${baht(selected.amount)}`} />
              <Fact k="ยอด" v={bahtExact(selected.amount)} />
              <Fact k="สถานะบิล" v={STATUS[selected.status] || selected.status} />
              <Fact k="สถานะเจ้าของ" v={STATUS[selected.owner.subscriptionStatus] || selected.owner.subscriptionStatus} />
              <Fact k="ต่ออายุถึง" v={selected.extendsTo ? thaiDate(selected.extendsTo) : selected.owner.expiresAt ? thaiDate(selected.owner.expiresAt) : 'หลังอนุมัติ'} />
              {selected.owner.subscriptionStatus === 'GRACE' && (
                <div className="bg-warn-bg rounded-xl px-3 py-2.5 text-[13px] text-warn-fg">
                  สถานะผ่อนผัน{graceDays !== null ? ` เหลือ ${Math.max(graceDays, 0)} วัน` : ''}ก่อนถูกระงับการเขียนข้อมูล
                </div>
              )}
              {selected.rejectReason && <p className="m-0 text-sm text-danger">เหตุผลเดิม: {selected.rejectReason}</p>}
              {canAct && (
                <>
                  <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
                    เหตุผล (ถ้าปฏิเสธ)
                    <input
                      placeholder="เช่น ยอดไม่ครบ"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="h-[42px] box-border border-[1.5px] border-line-input rounded-[10px] px-3 font-sans text-sm"
                    />
                  </label>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)' }}>
                    <button type="button" disabled={busy} onClick={reject} className="h-11 border-0 rounded-[10px] bg-danger-bg text-danger font-sans text-[15px] font-bold disabled:opacity-50">
                      ปฏิเสธ
                    </button>
                    <button type="button" disabled={busy} onClick={approve} className="h-11 border-0 rounded-[10px] bg-primary text-white font-sans text-[15px] font-bold disabled:opacity-50">
                      อนุมัติ + ต่ออายุ
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="bg-white rounded-[18px] p-[22px] flex flex-col gap-3">
        <h2 className="m-0 font-display text-lg font-semibold">รายการล่าสุด</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted text-[13px]">
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">เจ้าของ</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">บิล</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold text-right">ยอด</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">สถานะ</th>
                <th className="px-3 py-2.5 border-b border-line-input font-semibold">วัน</th>
              </tr>
            </thead>
            <tbody>
              {others.slice(0, 20).map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => setSelectedId(p.id)}>
                  <td className="p-3 border-b border-line-soft">{p.owner.name}</td>
                  <td className="p-3 border-b border-line-soft">{p.billNo}</td>
                  <td className="p-3 border-b border-line-soft text-right">{baht(p.amount)}</td>
                  <td className="p-3 border-b border-line-soft">{STATUS[p.status] || p.status}</td>
                  <td className="p-3 border-b border-line-soft">{thaiDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {others.length === 0 && <p className="text-sm text-muted text-center py-6 m-0">ยังไม่มีรายการอื่น</p>}
        </div>
      </section>
    </div>
  )
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  )
}
