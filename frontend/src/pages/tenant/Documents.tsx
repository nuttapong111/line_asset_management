import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { openPdfViewer } from '../../lib/pdfNav'

interface DocItem {
  kind: 'invoice' | 'receipt' | 'contract'
  id: string
  title: string
  subtitle: string
  date: string
  status: string
  statusKind: 'paid' | 'pending' | 'overdue' | 'info' | 'gray'
  href: string
  unpaid?: boolean
}

const FILTERS: { key: 'all' | 'invoice' | 'receipt' | 'contract'; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'invoice', label: 'บิล' },
  { key: 'receipt', label: 'ใบเสร็จ' },
  { key: 'contract', label: 'สัญญา' },
]

const MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function monthLabel(iso: string) {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth() + 1] || ''} ${d.getFullYear() + 543}`
}

function pill(item: DocItem) {
  if (item.kind === 'receipt') return { label: 'PDF', cls: 'bg-surface-2 text-ink-2' }
  if (item.statusKind === 'overdue') return { label: item.status, cls: 'bg-danger-bg text-danger' }
  if (item.statusKind === 'paid') return { label: item.status, cls: 'bg-ok-bg text-ok-fg' }
  if (item.statusKind === 'info' || item.statusKind === 'pending') return { label: item.status, cls: 'bg-info-bg text-info' }
  return { label: item.status, cls: 'bg-neutral-bg text-neutral-fg' }
}

export default function Documents() {
  const nav = useNavigate()
  const [items, setItems] = useState<DocItem[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/documents')
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false))
  }, [])

  const shown = items.filter((i) => filter === 'all' || i.kind === filter)
  const contract = shown.find((i) => i.kind === 'contract')
  const groups = useMemo(() => {
    const map = new Map<string, DocItem[]>()
    for (const item of shown) {
      if (item.kind === 'contract') continue
      const key = monthLabel(item.date)
      const list = map.get(key) || []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [shown])

  function open(item: DocItem) {
    if (item.href.startsWith('receipt-pdf:')) {
      const paymentId = item.href.replace('receipt-pdf:', '')
      openPdfViewer(nav, `payments/${paymentId}/receipt/pdf`, { title: 'ใบเสร็จรับเงิน', sub: item.title })
      return
    }
    if (item.unpaid) {
      nav(`/payment/${item.id}`)
      return
    }
    nav(item.href)
  }

  const contractDays = contract ? Math.ceil((new Date(contract.date).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="pb-24">
      <div className="px-4 pt-5 flex flex-col gap-3.5">
        <h1 className="font-display text-[26px] font-bold m-0">เอกสาร</h1>
        <div role="tablist" className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-segment">
          {FILTERS.map((f) => {
            const on = filter === f.key
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.key)}
                className={`h-9 rounded-[9px] text-sm ${on ? 'bg-white text-ink font-bold' : 'bg-transparent text-muted font-semibold'}`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex flex-col gap-2">
            <div className="h-16 rounded-card bg-surface-2" />
            <div className="h-28 rounded-card bg-surface-2" />
          </div>
        )}

        {!loading && contract && (filter === 'all' || filter === 'contract') && (
          <button
            type="button"
            onClick={() => nav(contract.href)}
            className="bg-white rounded-card px-4 py-3.5 text-left text-ink flex items-center gap-3"
          >
            <span className="w-11 h-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />
              </svg>
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <strong className="text-[15px]">{contract.title}</strong>
              <span className="text-[13px] text-muted">{contract.subtitle}</span>
            </span>
            {contractDays != null && contractDays >= 0 && contractDays <= 60 ? (
              <span className="px-2.5 py-1 rounded-full bg-warn-bg text-warn-fg text-xs font-bold shrink-0">เหลือ {contractDays} วัน</span>
            ) : (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${pill(contract).cls}`}>{contract.status}</span>
            )}
          </button>
        )}

        {!loading &&
          groups.map(([month, rows]) => (
            <section key={month} className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-muted">{month}</span>
              <div className="bg-white rounded-card overflow-hidden">
                {rows.map((item) => {
                  const tag = pill(item)
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => open(item)}
                      className="w-full px-4 py-3 border-b border-[#EEF1EF] last:border-b-0 text-left text-ink flex items-center gap-3"
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted shrink-0" aria-hidden>
                        <path d={item.kind === 'receipt' ? 'M6 3h9l4 4v14H6zM9 13l2 2 4-4' : 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6'} />
                      </svg>
                      <span className="flex-1 min-w-0 flex flex-col">
                        <strong className="text-[15px] truncate">{item.title}</strong>
                        <span className="text-[13px] text-muted truncate">{item.subtitle}</span>
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${tag.cls}`}>{tag.label}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}

        {!loading && shown.length === 0 && <p className="text-center text-muted py-8">ยังไม่มีเอกสารในหมวดนี้</p>}
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
