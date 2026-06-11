import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge, Chip } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { thaiDate } from '../../lib/utils'

interface Ticket {
  id: string
  ticketNo: string
  title: string
  category: string
  status: string
  createdAt: string
}

const STATUS_TH: Record<string, string> = {
  NEW: 'แจ้งใหม่', ACKNOWLEDGED: 'รับเรื่อง', IN_PROGRESS: 'กำลังซ่อม', SCHEDULED: 'นัดหมาย', DONE: 'เสร็จแล้ว', CLOSED: 'ปิดงาน',
}
const CAT_ICON: Record<string, string> = { ELECTRIC: '⚡', PLUMBING: '🚰', APPLIANCE: '🔌', GENERAL: '🔧' }

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'open', label: 'รอดำเนินการ' },
  { key: 'progress', label: 'กำลังซ่อม' },
  { key: 'done', label: 'เสร็จแล้ว' },
]

export default function MaintenanceList() {
  const nav = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.get('/maintenance').then((r) => setTickets(r.data))
  }, [])

  const filtered = tickets.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'open') return ['NEW', 'ACKNOWLEDGED'].includes(t.status)
    if (filter === 'progress') return ['IN_PROGRESS', 'SCHEDULED'].includes(t.status)
    if (filter === 'done') return ['DONE', 'CLOSED'].includes(t.status)
    return true
  })

  return (
    <div className="pb-24">
      <TopBar title="แจ้งซ่อม" back={false} />
      <div className="p-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</Chip>)}
        </div>
        {filtered.map((t) => (
          <Card key={t.id} className="flex items-center gap-3" onClick={() => nav(`/tenant/maintenance/${t.id}`)}>
            <span className="text-2xl">{CAT_ICON[t.category]}</span>
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-gray-400">{t.ticketNo} · {thaiDate(t.createdAt)}</div>
            </div>
            <Badge kind={['DONE', 'CLOSED'].includes(t.status) ? 'paid' : 'info'}>{STATUS_TH[t.status]}</Badge>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีรายการ</p>}
      </div>

      <button onClick={() => nav('/tenant/maintenance/new')} className="fixed bottom-20 right-4 z-30 bg-line text-white w-14 h-14 rounded-full shadow-lg text-2xl">
        +
      </button>
      <BottomNav role="TENANT" />
    </div>
  )
}
