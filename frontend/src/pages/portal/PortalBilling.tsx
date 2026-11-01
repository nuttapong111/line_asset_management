import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/axios'
import { bahtExact, thaiDate, thaiDateTime, thaiMonth } from '../../lib/utils'
import { AuthImage } from '../../components/AuthImage'

interface Payment {
  id: string
  status: string
  ocrAmount?: string | number | null
  ocrMatched?: boolean | null
  ocrAccountMatched?: boolean | null
  slipUploadedAt?: string | null
  slipUrl?: string | null
}

interface Invoice {
  id: string
  type: string
  month: number
  year: number
  total: string
  status: string
  dueDate: string
  tenantName?: string | null
  unit: { roomNumber: string }
  payment?: Payment | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'รอชำระ', cls: 'bg-info-bg text-info' },
  SLIP_UPLOADED: { label: 'รอตรวจสลิป', cls: 'bg-warn-bg text-warn-fg' },
  PAID: { label: 'ชำระแล้ว', cls: 'bg-ok-bg text-ok-fg' },
  OVERDUE: { label: 'เลยกำหนด', cls: 'bg-danger-bg text-danger' },
  CANCELLED: { label: 'ยกเลิก', cls: 'bg-neutral-bg text-neutral-fg' },
}

const FILTERS = ['ALL', 'PENDING', 'SLIP_UPLOADED', 'PAID', 'OVERDUE'] as const
const REJECTS = ['ยอดไม่ครบ', 'สลิปไม่ชัด', 'บัญชีปลายทางไม่ตรง', 'อื่นๆ']

function billLabel(r: Invoice) {
  const kind = r.type === 'UTILITY' ? 'ค่าน้ำไฟ' : r.type === 'SHORTFALL' ? 'ส่วนต่าง' : r.type === 'CONTRACT' ? 'ค่าแรกเข้า' : 'ค่าเช่า'
  return `${kind} ${thaiMonth(r.month)} ${r.year + 543}`
}

export default function PortalBilling() {
  const [rows, setRows] = useState<Invoice[]>([])
  const [tab, setTab] = useState<'ALL' | 'RENT' | 'UTILITY'>('ALL')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string>()
  const [reason, setReason] = useState(REJECTS[0])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  function load() {
    api.get('/invoices').then((r) => {
      const list = r.data as Invoice[]
      setRows(list)
      setActiveId((cur) => cur || list.find((i) => i.status === 'SLIP_UPLOADED' && i.payment)?.id || list[0]?.id)
    })
  }
  useEffect(() => {
    load()
  }, [])

  const typed = rows.filter((r) => tab === 'ALL' || r.type === tab)
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: typed.length }
    for (const k of FILTERS) if (k !== 'ALL') c[k] = typed.filter((r) => r.status === k).length
    return c
  }, [typed])

  const shown = typed.filter((r) => {
    if (filter !== 'ALL' && r.status !== filter) return false
    if (!q.trim()) return true
    return r.unit.roomNumber.toLowerCase().includes(q.trim().toLowerCase())
  })

  const active = rows.find((r) => r.id === activeId)
  const allChecked = shown.length > 0 && shown.every((r) => picked.includes(r.id))

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  function toggleAll() {
    setPicked(allChecked ? [] : shown.map((r) => r.id))
  }

  async function remind() {
    const { data } = await api.post('/invoices/remind', { invoiceIds: picked })
    setNote(`ส่งเตือนแล้ว ${data.sent} รายการ`)
    setPicked([])
  }

  async function exportCsv() {
    const header = ['ห้อง', 'ประเภท', 'เดือน', 'ยอด', 'สถานะ', 'ครบกำหนด']
    const lines = shown.map((r) =>
      [r.unit.roomNumber, r.type, `${r.month}/${r.year}`, r.total, STATUS[r.status]?.label || r.status, r.dueDate.slice(0, 10)].join(',')
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bills.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function approve() {
    if (!active?.payment) return
    setBusy(true)
    setNote('')
    try {
      const total = Number(active.total)
      const ocr = active.payment.ocrAmount != null ? Number(active.payment.ocrAmount) : null
      const short = ocr != null && ocr + 0.009 < total
      await api.post(`/payments/${active.payment.id}/approve`, { acceptShortfall: short })
      setNote('อนุมัติแล้ว')
      load()
    } catch (e: any) {
      setNote(e.response?.data?.error || 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!active?.payment) return
    setBusy(true)
    setNote('')
    try {
      await api.post(`/payments/${active.payment.id}/reject`, { rejectReason: reason })
      setNote('ปฏิเสธสลิปแล้ว')
      load()
    } catch (e: any) {
      setNote(e.response?.data?.error || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const pay = active?.payment
  const total = active ? Number(active.total) : 0
  const ocr = pay?.ocrAmount != null ? Number(pay.ocrAmount) : null
  const gap = ocr != null ? Math.round((total - ocr) * 100) / 100 : null
  const canReview = Boolean(pay && (active?.status === 'SLIP_UPLOADED' || pay.status === 'UNDER_REVIEW'))

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-display text-[28px] font-bold">บิลและการชำระ</h1>
          <span className="text-sm text-muted">ทุกอาคาร · {rows.length} บิล</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={exportCsv} className="h-11 px-4 rounded-[10px] border-[1.5px] border-line-input bg-white text-ink font-sans text-[15px] font-semibold">
            ส่งออก CSV
          </button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-segment">
          {(
            [
              ['ALL', 'ทั้งหมด'],
              ['RENT', 'ค่าเช่า'],
              ['UTILITY', 'ค่าน้ำไฟ'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`h-9 px-4 border-0 rounded-[9px] font-sans text-sm ${tab === k ? 'bg-white text-ink font-bold' : 'bg-transparent text-muted font-semibold'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((k) => {
            const on = filter === k
            const label = k === 'ALL' ? 'ทั้งหมด' : STATUS[k].label
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(k)}
                className={`h-9 px-3 rounded-full border-[1.5px] font-sans text-sm font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-line-input bg-white text-ink'}`}
              >
                {label} · {counts[k] || 0}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-line-input bg-white" style={{ flex: '0 1 260px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-muted" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="ค้นหา"
            placeholder="ค้นหาห้อง"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-0 border-0 outline-none font-sans text-sm bg-transparent"
          />
        </label>
      </div>

      {note && <p className="m-0 text-sm text-ok-fg">{note}</p>}

      <div className="flex flex-wrap gap-4 items-start">
        <section className="min-w-0 bg-white rounded-[18px] overflow-hidden" style={{ flex: '3 1 560px' }}>
          {picked.length > 0 && (
            <div className="bg-sidebar text-white px-4 py-2.5 flex flex-wrap gap-3 items-center">
              <strong className="text-sm">เลือก {picked.length} บิล</strong>
              <button type="button" onClick={remind} className="h-[34px] px-3 border-0 rounded-lg bg-brand text-ink font-sans text-sm font-bold">
                ส่งเตือนทาง LINE
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted text-[13px]">
                  <th className="px-4 py-2.5 border-b border-line-input w-6">
                    <input type="checkbox" aria-label="เลือกทั้งหมด" checked={allChecked} onChange={toggleAll} className="w-[18px] h-[18px] accent-primary" />
                  </th>
                  <th className="px-2 py-2.5 border-b border-line-input font-semibold">ห้อง</th>
                  <th className="px-2 py-2.5 border-b border-line-input font-semibold">ผู้เช่า</th>
                  <th className="px-2 py-2.5 border-b border-line-input font-semibold">ประเภท</th>
                  <th className="px-2 py-2.5 border-b border-line-input font-semibold">ครบกำหนด</th>
                  <th className="px-2 py-2.5 border-b border-line-input font-semibold text-right">ยอด</th>
                  <th className="px-4 py-2.5 border-b border-line-input font-semibold">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const st = STATUS[r.status] || { label: r.status, cls: 'bg-neutral-bg text-neutral-fg' }
                  const on = r.id === activeId
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setActiveId(r.id)}
                      className={`cursor-pointer ${on ? 'bg-primary-soft' : picked.includes(r.id) ? 'bg-canvas' : 'bg-white'}`}
                    >
                      <td className="px-4 py-3 border-b border-line-soft" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.unit.roomNumber}`} className="w-[18px] h-[18px] accent-primary" />
                      </td>
                      <td className="px-2 py-3 border-b border-line-soft font-bold">{r.unit.roomNumber}</td>
                      <td className="px-2 py-3 border-b border-line-soft text-muted">{r.tenantName || '—'}</td>
                      <td className="px-2 py-3 border-b border-line-soft text-muted">{billLabel(r)}</td>
                      <td className="px-2 py-3 border-b border-line-soft text-muted">{thaiDate(r.dueDate)}</td>
                      <td className="px-2 py-3 border-b border-line-soft text-right font-bold pf-amount">{bahtExact(r.total)}</td>
                      <td className="px-4 py-3 border-b border-line-soft">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[13px] font-semibold whitespace-nowrap ${st.cls}`}>{st.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="p-8 text-center text-muted m-0">ยังไม่มีบิลในตัวกรองนี้</p>}
        </section>

        <aside aria-label={active ? `ตรวจสลิป ${active.unit.roomNumber}` : 'ตรวจสลิป'} className="min-w-0 bg-white rounded-[18px] p-5 flex flex-col gap-3.5" style={{ flex: '1 1 320px' }}>
          {!active && <p className="text-sm text-muted m-0">ยังไม่มีบิล</p>}
          {active && (
            <>
              <div className="flex justify-between items-center">
                <strong className="font-display text-lg">ตรวจสลิป · {active.unit.roomNumber}</strong>
                <span className={`px-2.5 py-0.5 rounded-full text-[13px] font-semibold ${STATUS[active.status]?.cls || ''}`}>
                  {STATUS[active.status]?.label || active.status}
                </span>
              </div>
              <div className="flex gap-3.5">
                {pay && (pay.slipUrl || pay.slipUploadedAt || active.status === 'SLIP_UPLOADED') ? (
                  <AuthImage path={`/payments/${pay.id}/slip`} alt="รูปสลิป" className="w-[120px] h-[180px] object-contain rounded-xl bg-surface-2 border border-line-input" />
                ) : (
                  <div className="w-[120px] h-[180px] rounded-xl bg-surface-2 border border-line-input flex items-center justify-center text-[13px] text-muted">
                    ยังไม่มีสลิป
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">ยอดบิล</span>
                    <strong>{bahtExact(total)}</strong>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">ยอดในสลิป (OCR)</span>
                    {ocr == null ? (
                      <strong className="text-muted">ยังไม่มีผล OCR</strong>
                    ) : gap != null && gap > 0 ? (
                      <strong className="text-danger">
                        {bahtExact(ocr)} · ขาด {bahtExact(gap)}
                      </strong>
                    ) : (
                      <strong className="text-ok-fg">{bahtExact(ocr)} · ตรง</strong>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">บัญชีปลายทาง</span>
                    <strong className={pay?.ocrAccountMatched ? 'text-ok-fg' : pay?.ocrAccountMatched === false ? 'text-danger' : 'text-ink'}>
                      {pay?.ocrAccountMatched ? 'ตรงกับอาคาร' : pay?.ocrAccountMatched === false ? 'ไม่ตรงกับอาคาร' : 'ยังไม่ตรวจ'}
                    </strong>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-muted">เวลาโอน</span>
                    <span>{pay?.slipUploadedAt ? thaiDateTime(pay.slipUploadedAt) : '—'}</span>
                  </div>
                </div>
              </div>
              {canReview && (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-muted">
                    เหตุผล (ถ้าปฏิเสธ)
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="h-[42px] border-[1.5px] border-line-input rounded-[10px] px-2.5 font-sans text-sm text-ink bg-white"
                    >
                      {REJECTS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)' }}>
                    <button type="button" disabled={busy} onClick={reject} className="h-11 border-0 rounded-[10px] bg-danger-bg text-danger font-sans text-[15px] font-bold disabled:opacity-50">
                      ปฏิเสธ
                    </button>
                    <button type="button" disabled={busy} onClick={approve} className="h-11 border-0 rounded-[10px] bg-primary text-white font-sans text-[15px] font-bold disabled:opacity-50">
                      อนุมัติ + ใบเสร็จ
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
