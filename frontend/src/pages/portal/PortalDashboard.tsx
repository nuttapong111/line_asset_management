import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/axios'
import { baht, thaiDate } from '../../lib/utils'

interface Dashboard {
  summary: {
    total: number
    collected: number
    pending: number
    overdue: number
    occupancyRate: number
    totalUnits: number
    occupiedUnits: number
    propertyCount: number
    pendingSlips: number
    contractsExpiring30: number
    contractsExpiring60: number
  }
  recentSlips: {
    id: string
    amount: number
    roomNumber: string
    propertyName: string
    tenantName: string
    slipUploadedAt?: string
  }[]
  expiringContracts: {
    id: string
    roomNumber: string
    propertyName: string
    tenantName: string
    endDate: string
  }[]
}

export default function PortalDashboard() {
  const [data, setData] = useState<Dashboard>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then((r) => setData(r.data))
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ'))
  }, [])

  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-gray-400">กำลังโหลด...</p>

  const s = data.summary
  const cards = [
    { label: 'รับแล้ว', value: baht(s.collected), tone: 'text-line' },
    { label: 'รอรับ', value: baht(s.pending), tone: 'text-amber-600' },
    { label: 'ค้างชำระ', value: baht(s.overdue), tone: 'text-danger' },
    { label: 'อัตราเช่า', value: `${s.occupancyRate}%`, tone: 'text-gray-800' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ภาพรวม</h1>
        <p className="text-sm text-gray-500 mt-1">
          {s.propertyCount} ทรัพย์สิน · {s.occupiedUnits}/{s.totalUnits} ห้องเช่าแล้ว
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`text-lg md:text-xl font-bold ${c.tone}`}>{c.value}</div>
            <div className="text-xs text-gray-400 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-2xl font-bold">{s.pendingSlips}</div>
          <div className="text-xs text-gray-400">สลิปรอตรวจ</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-2xl font-bold">{s.contractsExpiring30}</div>
          <div className="text-xs text-gray-400">สัญญาหมดใน 30 วัน</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="text-2xl font-bold">{s.contractsExpiring60}</div>
          <div className="text-xs text-gray-400">สัญญาหมดใน 60 วัน</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">สลิปรอตรวจล่าสุด</h2>
            <Link to="/portal/reports" className="text-xs text-line hover:underline">
              ดูรายงาน
            </Link>
          </div>
          {data.recentSlips.length === 0 && <p className="text-sm text-gray-400">ไม่มีสลิปรอตรวจ</p>}
          <div className="space-y-2">
            {data.recentSlips.map((p) => (
              <div key={p.id} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <div className="font-medium">
                    {p.propertyName} · ห้อง {p.roomNumber}
                  </div>
                  <div className="text-xs text-gray-400">
                    {p.tenantName} · {thaiDate(p.slipUploadedAt)}
                  </div>
                </div>
                <div className="font-semibold text-line">{baht(p.amount)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="font-semibold mb-3">สัญญาใกล้หมดอายุ</h2>
          {data.expiringContracts.length === 0 && <p className="text-sm text-gray-400">ไม่มีสัญญาใกล้หมด</p>}
          <div className="space-y-2">
            {data.expiringContracts.map((c) => (
              <div key={c.id} className="flex justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <div className="font-medium">
                    {c.propertyName} · ห้อง {c.roomNumber}
                  </div>
                  <div className="text-xs text-gray-400">{c.tenantName}</div>
                </div>
                <div className="text-xs text-amber-600 font-medium">{thaiDate(c.endDate)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
