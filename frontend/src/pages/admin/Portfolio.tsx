import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { baht } from '../../lib/utils'
import { Card, Badge } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'

interface PropertyStats {
  id: string
  name: string
  bankName?: string
  bankAccount?: string
  stats: { total: number; occupied: number; tenants: number; overdue: number; monthlyRevenue: number }
}

interface Queue {
  summary: {
    pendingSlips: number
    overdue: number
    contractsExpiring30: number
    unackedMaintenance: number
    renewalRequests: number
  }
  recentSlips: { id: string; roomNumber: string; tenantName: string; amount: number }[]
  overdueInvoices: { id: string; roomNumber: string; tenantName: string; total: number }[]
  pendingRenewals: { id: string; roomNumber: string; tenantName: string }[]
  newTickets: { id: string; ticketNo: string; title: string; roomNumber: string }[]
  expiringContracts: { id: string; roomNumber: string; tenantName: string }[]
}

export default function Portfolio() {
  const nav = useNavigate()
  const [props, setProps] = useState<PropertyStats[]>([])
  const [queue, setQueue] = useState<Queue>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/properties').then((r) => setProps(r.data)).catch(() => {}),
      api.get('/reports/dashboard').then((r) => setQueue(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const totalRooms = props.reduce((a, p) => a + p.stats.total, 0)
  const totalRevenue = props.reduce((a, p) => a + p.stats.monthlyRevenue, 0)
  const totalOverdue = props.reduce((a, p) => a + p.stats.overdue, 0)

  return (
    <div className="pb-20">
      <div className="bg-line text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <p className="text-white/80 text-sm">ยินดีต้อนรับสู่</p>
        <h1 className="text-2xl font-bold">PropFlow</h1>
        <div className="grid grid-cols-4 gap-2 mt-5">
          {[
            { label: 'อาคาร', value: props.length },
            { label: 'ห้อง', value: totalRooms },
            { label: 'รายได้/ด.', value: baht(totalRevenue) },
            { label: 'ค้างชำระ', value: totalOverdue },
          ].map((k) => (
            <div key={k.label} className="bg-white/15 rounded-xl p-2 text-center">
              <div className="text-sm font-bold truncate">{k.value}</div>
              <div className="text-[10px] text-white/80">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {queue && (
          <Card>
            <h2 className="font-semibold mb-3">งานวันนี้</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <QueueStat label="สลิปรอตรวจ" value={queue.summary.pendingSlips} onClick={() => nav('/admin/billing')} />
              <QueueStat label="ค้างชำระ" value={queue.overdueInvoices?.length ?? 0} onClick={() => nav('/admin/billing')} />
              <QueueStat label="ขอต่อสัญญา" value={queue.summary.renewalRequests} />
              <QueueStat label="ซ่อมยังไม่รับ" value={queue.summary.unackedMaintenance} />
            </div>
            {queue.recentSlips.slice(0, 3).map((p) => (
              <button
                key={p.id}
                className="w-full text-left text-sm py-2 border-t border-gray-50 flex justify-between"
                onClick={() => nav(`/admin/slip/${p.id}`)}
              >
                <span>สลิป ห้อง {p.roomNumber} · {p.tenantName}</span>
                <span className="text-line font-medium">{baht(p.amount)}</span>
              </button>
            ))}
            {queue.pendingRenewals?.slice(0, 3).map((c) => (
              <button
                key={c.id}
                className="w-full text-left text-sm py-2 border-t border-gray-50"
                onClick={() => nav(`/admin/contract/${c.id}`)}
              >
                ขอต่อสัญญา ห้อง {c.roomNumber} · {c.tenantName}
              </button>
            ))}
            {queue.newTickets?.slice(0, 3).map((t) => (
              <button
                key={t.id}
                className="w-full text-left text-sm py-2 border-t border-gray-50"
                onClick={() => nav(`/admin/maintenance/${t.id}`)}
              >
                ซ่อม {t.ticketNo} ห้อง {t.roomNumber}
              </button>
            ))}
            {queue.summary.pendingSlips === 0 &&
              !queue.pendingRenewals?.length &&
              !queue.newTickets?.length &&
              !queue.overdueInvoices?.length && (
                <p className="text-sm text-gray-400">ไม่มีงานค้าง</p>
              )}
          </Card>
        )}
        {loading && <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>}
        {!loading && props.length === 0 && (
          <p className="text-center text-gray-400 py-8">ยังไม่มีอสังหาฯ เริ่มเพิ่มได้เลย</p>
        )}
        {props.map((p) => {
          const rate = p.stats.total ? Math.round((p.stats.occupied / p.stats.total) * 100) : 0
          return (
            <Card key={p.id} onClick={() => nav(`/admin/property/${p.id}`)}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <p className="text-gray-400 text-xs">{p.bankName} {p.bankAccount}</p>
                </div>
                {p.stats.overdue > 0 && <Badge kind="overdue">ค้าง {p.stats.overdue}</Badge>}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>อัตราการเช่า</span>
                  <span>{p.stats.occupied}/{p.stats.total} ห้อง ({rate}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-line" style={{ width: `${rate}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <Stat label="ห้อง" value={p.stats.total} />
                <Stat label="ผู้เช่า" value={p.stats.tenants} />
                <Stat label="รายได้/ด." value={baht(p.stats.monthlyRevenue)} />
              </div>
            </Card>
          )
        })}

        <button
          onClick={() => nav('/admin/property/new')}
          className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 text-gray-500 font-medium active:bg-gray-50"
        >
          + เพิ่มอสังหาฯใหม่
        </button>
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}

function QueueStat({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-gray-50 rounded-xl py-2 text-center"
    >
      <div className={`font-semibold text-sm ${value ? 'text-amber-700' : 'text-gray-800'}`}>{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl py-2">
      <div className="font-semibold text-sm">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  )
}
