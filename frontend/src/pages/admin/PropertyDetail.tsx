import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { baht, cls } from '../../lib/utils'
import { Card, Badge, Chip, Button } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

interface Unit {
  id: string
  roomNumber: string
  floor?: number
  rentPrice: string
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'
  tenants: { id: string; name: string }[]
  invoices: { id: string; status: string }[]
}
interface Property {
  id: string
  name: string
  address?: string
  bankName?: string
  bankAccount?: string
  promptpayNumber: string
  paymentQrUrl?: string | null
  units: Unit[]
}

const FILTERS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'occupied', label: 'มีผู้เช่า' },
  { key: 'overdue', label: 'ค้าง' },
  { key: 'vacant', label: 'ว่าง' },
]

export default function PropertyDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [prop, setProp] = useState<Property>()
  const [filter, setFilter] = useState('all')

  const [qrUploading, setQrUploading] = useState(false)
  const load = () => api.get(`/properties/${id}`).then((r) => setProp(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function uploadQr(file: File) {
    setQrUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/properties/${id}/payment-qr`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
    } finally {
      setQrUploading(false)
    }
  }

  async function removeQr() {
    await api.delete(`/properties/${id}/payment-qr`)
    await load()
  }

  if (!prop) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  const units = prop.units.filter((u) => {
    if (filter === 'all') return true
    if (filter === 'occupied') return u.status === 'OCCUPIED'
    if (filter === 'vacant') return u.status === 'VACANT'
    if (filter === 'overdue') return u.invoices[0]?.status === 'OVERDUE'
    return true
  })

  return (
    <div className="pb-6">
      <TopBar
        title={prop.name}
        right={
          <button onClick={() => nav(`/admin/property/${id}/unit/new`)} className="text-line font-medium text-sm px-2">
            + ห้อง
          </button>
        }
      />
      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </Chip>
          ))}
        </div>

        <div className="space-y-2">
          {units.map((u) => {
            const tenant = u.tenants[0]
            const overdue = u.invoices[0]?.status === 'OVERDUE'
            const statusColor =
              u.status === 'OCCUPIED' ? (overdue ? 'bg-danger' : 'bg-line') : u.status === 'MAINTENANCE' ? 'bg-amber' : 'bg-gray-300'
            return (
              <Card key={u.id} className="flex items-center gap-3 py-3">
                <div className={cls('w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold text-sm', statusColor)}>
                  {u.roomNumber}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{tenant ? tenant.name : <span className="text-gray-400">ว่าง</span>}</div>
                  <div className="text-xs text-gray-400">{baht(u.rentPrice)}/เดือน</div>
                </div>
                {u.status === 'VACANT' ? (
                  <Button variant="ghost" className="w-auto px-3 py-1.5 text-sm" onClick={() => nav(`/admin/property/${id}/tenant/new?unitId=${u.id}`)}>
                    + ผู้เช่า
                  </Button>
                ) : (
                  <Badge kind={overdue ? 'overdue' : 'paid'}>{overdue ? 'ค้างชำระ' : 'ปกติ'}</Badge>
                )}
              </Card>
            )
          })}
          {units.length === 0 && <p className="text-center text-gray-400 py-6">ไม่มีห้องในหมวดนี้</p>}
        </div>

        <Card>
          <h3 className="font-semibold mb-2">ข้อมูลรับชำระเงิน</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">ธนาคาร</span><span>{prop.bankName || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">เลขบัญชี</span><span>{prop.bankAccount || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">พร้อมเพย์</span><span>{prop.promptpayNumber}</span></div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="font-medium text-sm mb-1">QR Code รับเงิน (ไม่บังคับ)</div>
            <p className="text-xs text-gray-400 mb-2">
              อัปโหลดรูป QR พร้อมเพย์/ธนาคารของคุณ ผู้เช่าจะเห็น QR นี้แทนการสร้างอัตโนมัติ
            </p>
            {prop.paymentQrUrl ? (
              <div className="space-y-2">
                <img src={prop.paymentQrUrl} alt="QR" className="w-40 h-40 object-contain border rounded-lg mx-auto" />
                <Button variant="danger" className="text-sm py-2" onClick={removeQr}>ลบรูป QR</Button>
              </div>
            ) : (
              <label className="block">
                <span className="inline-block bg-gray-100 rounded-lg px-3 py-2 text-sm cursor-pointer">
                  {qrUploading ? 'กำลังอัปโหลด...' : '+ อัปโหลดรูป QR'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  disabled={qrUploading}
                  onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])}
                />
              </label>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => nav(`/admin/property/${id}/meter`)}>บันทึกมิเตอร์</Button>
          <Button variant="secondary" onClick={() => nav('/admin/invoice-builder')}>สร้างบิล</Button>
        </div>
      </div>
    </div>
  )
}
