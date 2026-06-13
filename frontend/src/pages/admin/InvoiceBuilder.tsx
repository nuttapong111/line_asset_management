import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Button, Card, Chip } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiMonth } from '../../lib/utils'

type BillType = 'RENT' | 'UTILITY'

interface Property { id: string; name: string }
interface Unit { id: string; roomNumber: string; status: string; tenants: { name: string }[] }
interface Preview { unitId: string; total: number }

export default function InvoiceBuilder() {
  const now = new Date()
  const [billType, setBillType] = useState<BillType>('RENT')
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [units, setUnits] = useState<Unit[]>([])
  const [previews, setPreviews] = useState<Record<string, Preview>>({})
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year] = useState(now.getFullYear())
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get('/properties').then((r) => {
      setProperties(r.data)
      if (r.data[0]) setPropertyId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!propertyId) return
    api.get(`/properties/${propertyId}/units`).then(async (r) => {
      const occupied = r.data.filter((u: Unit) => u.status === 'OCCUPIED')
      setUnits(occupied)
      const map: Record<string, Preview> = {}
      for (const u of occupied) {
        try {
          const { data } = await api.post('/invoices/build-preview', { unitId: u.id, month, year, type: billType })
          map[u.id] = { unitId: u.id, total: data.total }
        } catch {
          map[u.id] = { unitId: u.id, total: 0 }
        }
      }
      setPreviews(map)
    })
  }, [propertyId, month, year, billType])

  const grandTotal = Object.values(previews).reduce((a, p) => a + p.total, 0)

  async function sendAll() {
    setSending(true)
    setResult(null)
    try {
      const { data } = await api.post('/invoices/send-all', { propertyId, month, year, type: billType })
      setResult(data)
    } finally {
      setSending(false)
    }
  }

  const isRent = billType === 'RENT'

  return (
    <div className="pb-4">
      <TopBar title="สร้างใบแจ้งหนี้" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <Chip active={isRent} onClick={() => setBillType('RENT')}>ค่าเช่ารายเดือน</Chip>
          <Chip active={!isRent} onClick={() => setBillType('UTILITY')}>ค่าน้ำ/ค่าไฟ</Chip>
        </div>

        <div className="bg-line-light rounded-xl p-3 text-sm text-line-dark">
          {isRent
            ? 'ค่าเช่าสร้างอัตโนมัติทุกเดือน (ตามวันที่ตั้งในการแจ้งเตือน) จนกว่าสัญญาจะยกเลิก — ปุ่มด้านล่างใช้ส่งซ้ำ/ส่งทันทีได้'
            : 'บิลค่าน้ำค่าไฟสร้างแยก — ต้องบันทึกมิเตอร์ก่อน ห้องที่ยังไม่มีมิเตอร์จะแสดง ฿0'}
        </div>

        <Card className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">อสังหาฯ</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">เดือน</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{thaiMonth(m)} {year}</option>)}
            </select>
          </div>
        </Card>

        <div className="space-y-2">
          {units.map((u) => (
            <Card key={u.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">ห้อง {u.roomNumber}</div>
                <div className="text-xs text-gray-400">{u.tenants[0]?.name || '-'}</div>
              </div>
              <div className={`font-semibold ${previews[u.id]?.total ? 'text-line' : 'text-gray-300'}`}>
                {previews[u.id]?.total ? baht(previews[u.id].total) : isRent ? baht(0) : 'ยังไม่มีมิเตอร์'}
              </div>
            </Card>
          ))}
          {units.length === 0 && <p className="text-center text-gray-400 py-6">ไม่มีห้องที่มีผู้เช่า</p>}
        </div>

        <Card className="flex justify-between items-center">
          <span className="font-semibold">รวมทั้งหมด</span>
          <span className="text-xl font-bold text-line">{baht(grandTotal)}</span>
        </Card>

        {result && (
          <div className="bg-line-light text-line-dark rounded-xl p-3 text-center text-sm">
            ส่งสำเร็จ {result.sent} ห้อง / ล้มเหลว {result.failed} ห้อง
          </div>
        )}

        <Button onClick={sendAll} disabled={sending || units.length === 0 || grandTotal === 0}>
          {sending ? 'กำลังส่ง...' : isRent ? 'ส่งใบแจ้งหนี้ค่าเช่า' : 'ส่งบิลค่าน้ำค่าไฟ'}
        </Button>
      </div>
    </div>
  )
}
