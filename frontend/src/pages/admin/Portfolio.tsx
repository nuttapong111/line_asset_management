import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { baht } from '../../lib/utils'
import { Card, Badge } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuthStore } from '../../store/authStore'

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
}

export default function Portfolio() {
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
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
  const pending =
    (queue?.summary.pendingSlips || 0) +
    (queue?.summary.unackedMaintenance || 0) +
    (queue?.summary.renewalRequests || 0) +
    (queue?.overdueInvoices?.length || 0)

  const navRole = role === 'OWNER' ? 'OWNER' : 'ADMIN'

  return (
    <div className="pb-20">
      <div className="bg-line text-white px-5 pt-7 pb-8 rounded-b-[28px]">
        <p className="text-white/75 text-sm">PropFlow</p>
        <h1 className="text-2xl font-bold mt-0.5">ภาพรวม</h1>
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: 'อาคาร', value: props.length },
            { label: 'ห้อง', value: totalRooms },
            { label: 'รายได้/ด.', value: baht(totalRevenue) },
          ].map((k) => (
            <div key={k.label} className="bg-white/15 rounded-2xl px-2 py-3 text-center">
              <div className="text-base font-bold truncate">{k.value}</div>
              <div className="text-[11px] text-white/80 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {queue && pending > 0 && (
          <Card className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">งานที่ต้องทำ</h2>
              <span className="text-xs text-amber-700 font-medium">{pending} รายการ</span>
            </div>
            {queue.recentSlips.slice(0, 2).map((p) => (
              <button
                key={p.id}
                className="w-full text-left text-sm py-2.5 border-t border-gray-50 flex justify-between"
                onClick={() => nav(`/admin/slip/${p.id}`)}
              >
                <span className="text-gray-700">สลิป ห้อง {p.roomNumber}</span>
                <span className="text-line font-medium">{baht(p.amount)}</span>
              </button>
            ))}
            {queue.overdueInvoices?.slice(0, 2).map((inv) => (
              <button
                key={inv.id}
                className="w-full text-left text-sm py-2.5 border-t border-gray-50"
                onClick={() => nav('/admin/billing')}
              >
                ค้างชำระ ห้อง {inv.roomNumber}
              </button>
            ))}
            {queue.newTickets?.slice(0, 2).map((t) => (
              <button
                key={t.id}
                className="w-full text-left text-sm py-2.5 border-t border-gray-50"
                onClick={() => nav(`/admin/maintenance/${t.id}`)}
              >
                ซ่อม {t.ticketNo}
              </button>
            ))}
          </Card>
        )}

        {loading && <p className="text-center text-gray-400 py-10">กำลังโหลด...</p>}
        {!loading && props.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <p className="text-gray-400 text-sm">ยังไม่มีอาคาร</p>
            <button
              onClick={() => nav('/admin/property/new')}
              className="text-line font-medium text-sm"
            >
              + เพิ่มอาคารแรก
            </button>
          </div>
        )}

        {props.map((p) => {
          const rate = p.stats.total ? Math.round((p.stats.occupied / p.stats.total) * 100) : 0
          return (
            <Card key={p.id} onClick={() => nav(`/admin/property/${p.id}`)} className="!py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-lg truncate">{p.name}</h3>
                  <p className="text-gray-400 text-xs mt-0.5 truncate">
                    {p.stats.occupied}/{p.stats.total} ห้อง · {baht(p.stats.monthlyRevenue)}/ด.
                  </p>
                </div>
                {p.stats.overdue > 0 ? (
                  <Badge kind="overdue">ค้าง {p.stats.overdue}</Badge>
                ) : (
                  <Badge kind="paid">{rate}%</Badge>
                )}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
                <div className="h-full bg-line rounded-full" style={{ width: `${rate}%` }} />
              </div>
            </Card>
          )
        })}

        {props.length > 0 && (
          <button
            onClick={() => nav('/admin/property/new')}
            className="w-full rounded-2xl py-3.5 text-sm text-gray-500 font-medium border border-dashed border-gray-300"
          >
            + เพิ่มอาคาร
          </button>
        )}
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
