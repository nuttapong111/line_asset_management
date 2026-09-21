import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDate, thaiMonth } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface ExtraItem { id?: string; label: string; amount: string | number }
interface Invoice {
  id: string
  type?: string
  month: number
  year: number
  rentAmount: string
  electricAmount: string
  waterAmount: string
  commonFee: string
  lateFee: string
  extraAmount?: string
  total: string
  dueDate: string
  status: string
  extraItems?: ExtraItem[]
  unit: { roomNumber: string; electricRate: string; waterRate: string }
  meterReading?: { prevElec: string; currElec: string; prevWater: string; currWater: string }
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const [inv, setInv] = useState<Invoice>()
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [savingExtra, setSavingExtra] = useState(false)

  const load = () => api.get(`/invoices/${id}`).then((r) => setInv(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!inv) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const m = inv.meterReading
  const usedElec = m ? Number(m.currElec) - Number(m.prevElec) : 0
  const usedWater = m ? Number(m.currWater) - Number(m.prevWater) : 0
  const extras = inv.extraItems ?? []
  const canEditExtras = (role === 'ADMIN' || role === 'OWNER') && ['PENDING', 'OVERDUE'].includes(inv.status)
  const isRent = inv.type !== 'UTILITY'

  async function saveExtras(items: { label: string; amount: number }[]) {
    setSavingExtra(true)
    try {
      await api.put(`/invoices/${id}/extra-items`, { items })
      await load()
      setNewLabel('')
      setNewAmount('')
    } finally {
      setSavingExtra(false)
    }
  }

  return (
    <div>
      <TopBar title="รายละเอียดบิล" />
      <div className="p-4 space-y-4">
        <div className="bg-line text-white rounded-2xl p-4 text-center">
          <p className="text-white/80 text-sm">ใบแจ้งหนี้ {thaiMonth(inv.month)} {inv.year}</p>
          <div className="text-3xl font-bold my-1">{baht(inv.total)}</div>
          <p className="text-white/80 text-xs">กำหนดชำระ {thaiDate(inv.dueDate)}</p>
        </div>

        <Card>
          <h4 className="font-semibold mb-2">รายการ</h4>
          {isRent && <Row label="ค่าเช่า" value={baht(inv.rentAmount)} />}
          {Number(inv.electricAmount) > 0 && (
            <Row label={`ค่าไฟ (${usedElec} หน่วย × ${baht(inv.unit.electricRate)})`} value={baht(inv.electricAmount)} />
          )}
          {Number(inv.waterAmount) > 0 && (
            <Row label={`ค่าน้ำ (${usedWater} หน่วย × ${baht(inv.unit.waterRate)})`} value={baht(inv.waterAmount)} />
          )}
          {isRent && Number(inv.commonFee) > 0 && <Row label="ค่าส่วนกลาง" value={baht(inv.commonFee)} />}
          {extras.map((x) => (
            <Row key={x.id || x.label} label={x.label} value={baht(x.amount)} />
          ))}
          {Number(inv.lateFee) > 0 && <Row label="ค่าปรับล่าช้า" value={baht(inv.lateFee)} />}
          <div className="flex justify-between font-bold text-line border-t border-gray-100 pt-2 mt-1">
            <span>รวม</span><span>{baht(inv.total)}</span>
          </div>
        </Card>

        {canEditExtras && (
          <Card className="space-y-3">
            <h4 className="font-semibold">เพิ่มรายการในบิลนี้</h4>
            {extras.map((x) => (
              <div key={x.id || x.label} className="flex justify-between text-sm">
                <span>{x.label}</span>
                <button
                  className="text-danger text-xs"
                  onClick={() =>
                    saveExtras(extras.filter((i) => i !== x).map((i) => ({ label: i.label, amount: Number(i.amount) })))
                  }
                >
                  ลบ
                </button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Input placeholder="เช่น ค่าเน็ต" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Input type="number" placeholder="ยอด" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>
            <Button
              className="py-2"
              disabled={savingExtra || !newLabel || !newAmount}
              onClick={() =>
                saveExtras([
                  ...extras.map((i) => ({ label: i.label, amount: Number(i.amount) })),
                  { label: newLabel.trim(), amount: Number(newAmount) },
                ])
              }
            >
              {savingExtra ? 'กำลังบันทึก...' : 'เพิ่มรายการ'}
            </Button>
          </Card>
        )}

        {m && (
          <Card>
            <h4 className="font-semibold mb-2">เลขมิเตอร์</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-400">⚡ ไฟฟ้า</div>
                <div>{m.prevElec} → {m.currElec}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">💧 น้ำ</div>
                <div>{m.prevWater} → {m.currWater}</div>
              </div>
            </div>
          </Card>
        )}

        {['PENDING', 'OVERDUE'].includes(inv.status) && (
          <Button onClick={() => nav(`/payment/${inv.id}`)}>ชำระเงิน {baht(inv.total)}</Button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  )
}
