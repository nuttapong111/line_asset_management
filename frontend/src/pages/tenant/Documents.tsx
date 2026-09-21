import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { openPdfViewer } from '../../lib/pdfNav'
import { thaiDate } from '../../lib/utils'

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

  function open(item: DocItem) {
    if (item.href.startsWith('receipt-pdf:')) {
      const paymentId = item.href.replace('receipt-pdf:', '')
      openPdfViewer(nav, `payments/${paymentId}/receipt/pdf`, { title: 'ใบเสร็จรับเงิน' })
      return
    }
    nav(item.href)
  }

  return (
    <div className="pb-20">
      <TopBar title="เอกสาร" back={false} />
      <div className="px-4 pt-3 flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
              filter === f.key ? 'bg-line text-white border-line' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-2">
        {loading && <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>}
        {!loading &&
          shown.map((item) => (
            <Card key={`${item.kind}-${item.id}`} className="flex items-center justify-between" onClick={() => open(item)}>
              <div className="min-w-0 pr-3">
                <div className="font-medium truncate">{item.title}</div>
                <div className="text-xs text-gray-400">
                  {item.subtitle} · {thaiDate(item.date)}
                </div>
              </div>
              <Badge kind={item.statusKind}>{item.status}</Badge>
            </Card>
          ))}
        {!loading && shown.length === 0 && <p className="text-center text-gray-400 py-8">ยังไม่มีเอกสารในหมวดนี้</p>}
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
