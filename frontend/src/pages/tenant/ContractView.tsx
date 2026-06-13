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
  tenant: { name: string }
  unit: { roomNumber: string; property: { name: string } }
}

export default function ContractView() {
  const { id } = useParams()
  const [contract, setContract] = useState<Contract>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const load = () => {
    const url = id ? `/contracts/${id}` : '/contracts/me'
    api.get(url).then((r) => setContract(r.data)).catch(() => setError('ยังไม่มีสัญญา'))
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) return (
    <div><TopBar title="สัญญาเช่า" /><p className="p-8 text-center text-gray-400">{error}</p></div>
  )
  if (!contract) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  async function downloadPdf() {
    setBusy(true)
    try {
      const { data } = await api.get(`/contracts/${contract!.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      alert('ไม่สามารถดาวน์โหลด PDF ได้')
    } finally {
      setBusy(false)
    }
  }

  async function printPdf() {
    setBusy(true)
    try {
      const { data } = await api.get(`/contracts/${contract!.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const w = window.open(url, '_blank')
      if (w) w.addEventListener('load', () => w.print())
      setTimeout(() => URL.revokeObjectURL(url), 120_000)
    } catch {
      alert('ไม่สามารถเปิด PDF สำหรับพิมพ์ได้')
    } finally {
      setBusy(false)
    }
  }

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
            <Field label="ค่าเช่า" value={baht(contract.rentAmount)} />
            <Field label="เงินประกัน" value={baht(contract.deposit)} />
            <Field label="วันครบกำหนด" value={`ทุกวันที่ ${contract.dueDay}`} />
            <Field label="เริ่มสัญญา" value={thaiDate(contract.startDate)} />
            <Field label="สิ้นสุด" value={thaiDate(contract.endDate)} />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={downloadPdf} disabled={busy}>{busy ? 'กำลังโหลด...' : 'ดาวน์โหลด PDF'}</Button>
          <Button variant="secondary" onClick={printPdf} disabled={busy}>ปริ้น PDF</Button>
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
