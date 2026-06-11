import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDate } from '../../lib/utils'

interface Contract {
  id: string
  startDate: string
  endDate: string
  rentAmount: string
  deposit: string
  dueDay: number
  lateFeePerDay: string
  status: string
  pdfUrl?: string
  terms?: string
  tenant: { name: string; phone: string }
  unit: { roomNumber: string; property: { name: string } }
}

export default function ContractView() {
  const { id } = useParams()
  const [contract, setContract] = useState<Contract>()
  const [busy, setBusy] = useState(false)

  const load = () => api.get(`/contracts/${id}`).then((r) => setContract(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!contract) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  async function genPdf() {
    setBusy(true)
    try {
      const { data } = await api.post(`/contracts/${id}/pdf`)
      window.open(data.pdfUrl, '_blank')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <div>
      <TopBar title="สัญญาเช่า" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-lg">{contract.unit.property.name}</h3>
              <p className="text-gray-400 text-sm">ห้อง {contract.unit.roomNumber}</p>
            </div>
            <Badge kind={contract.status === 'ACTIVE' ? 'paid' : 'gray'}>{contract.status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="ผู้เช่า" value={contract.tenant.name} />
            <Field label="เบอร์โทร" value={contract.tenant.phone} />
            <Field label="ค่าเช่า" value={baht(contract.rentAmount)} />
            <Field label="เงินประกัน" value={baht(contract.deposit)} />
            <Field label="เริ่มสัญญา" value={thaiDate(contract.startDate)} />
            <Field label="สิ้นสุด" value={thaiDate(contract.endDate)} />
            <Field label="วันครบกำหนด" value={`ทุกวันที่ ${contract.dueDay}`} />
            <Field label="ค่าปรับ/วัน" value={baht(contract.lateFeePerDay)} />
          </div>
        </Card>

        {daysLeft <= 60 && contract.status === 'ACTIVE' && (
          <Card className="border-amber bg-amber-50">
            <p className="text-amber-700 text-sm">สัญญาจะหมดอายุในอีก {daysLeft} วัน</p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={genPdf} disabled={busy}>{busy ? 'กำลังสร้าง...' : 'สร้าง PDF ↓'}</Button>
          <Button variant="secondary" onClick={() => window.print()}>ปริ้น</Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
