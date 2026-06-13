import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { openPdfViewer } from '../../lib/pdfNav'
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
  signedAt?: string | null
  tenant: { name: string }
  unit: { roomNumber: string; property: { name: string } }
}

export default function ContractView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [contract, setContract] = useState<Contract>()
  const [error, setError] = useState<string>()

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

  function viewPdf(print?: boolean) {
    openPdfViewer(nav, `contracts/${contract!.id}/pdf`, { title: 'สัญญาเช่า', print })
  }

  function viewSigned() {
    openPdfViewer(nav, `contracts/${contract!.id}/signed`, { title: 'สัญญาที่ลงนามแล้ว' })
  }

  const hasSigned = Boolean(contract.signedAt)

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
          <Button variant="secondary" onClick={() => viewPdf()}>ดู / ดาวน์โหลด PDF</Button>
          <Button variant="secondary" onClick={() => viewPdf(true)}>ปริ้น PDF</Button>
        </div>
        {hasSigned && (
          <Button onClick={viewSigned}>ดูสัญญาที่ลงนามแล้ว</Button>
        )}
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
