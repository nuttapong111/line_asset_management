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
  signedDocumentUrl?: string | null
  signedAt?: string | null
  terms?: string
  tenant: { name: string; phone: string }
  unit: { roomNumber: string; property: { name: string } }
}

export default function ContractView() {
  const { id } = useParams()
  const nav = useNavigate()
  const [contract, setContract] = useState<Contract>()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>()

  const load = () => api.get(`/contracts/${id}`).then((r) => setContract(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!contract) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  function viewPdf(print?: boolean) {
    openPdfViewer(nav, `contracts/${id}/pdf`, { title: 'สัญญาเช่า (แบบร่าง)', print })
  }

  function viewSigned() {
    openPdfViewer(nav, `contracts/${id}/signed`, { title: 'สัญญาที่ลงนามแล้ว' })
  }

  async function uploadSigned(file: File) {
    setUploading(true)
    setUploadError(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/contracts/${id}/signed`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setUploadError(typeof msg === 'string' ? msg : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  async function removeSigned() {
    if (!confirm('ลบหลักฐานการลงนามนี้?')) return
    setUploading(true)
    try {
      await api.delete(`/contracts/${id}/signed`)
      await load()
    } finally {
      setUploading(false)
    }
  }

  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const hasSigned = Boolean(contract.signedAt)

  return (
    <div className="pb-6">
      <TopBar title="สัญญาเช่า" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-lg">{contract.unit.property.name}</h3>
              <p className="text-gray-400 text-sm">ห้อง {contract.unit.roomNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge kind={contract.status === 'ACTIVE' ? 'paid' : 'gray'}>{contract.status}</Badge>
              <Badge kind={hasSigned ? 'paid' : 'pending'}>{hasSigned ? 'ลงนามแล้ว' : 'รอลงนาม'}</Badge>
            </div>
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

        <Card>
          <h3 className="font-semibold mb-2">ขั้นตอนลงนามสัญญา</h3>
          <ol className="text-sm text-gray-600 space-y-2 mb-4 list-decimal list-inside">
            <li>ปริ้น PDF สัญญาจากระบบ (ปุ่มด้านล่าง)</li>
            <li>ให้ผู้เช่าและเจ้าของลงนามบนเอกสารจริง</li>
            <li>ถ่ายรูปหรือสแกนแล้วแนบกลับเป็นหลักฐานในระบบ</li>
          </ol>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Button variant="secondary" onClick={() => viewPdf()}>ดู PDF แบบร่าง</Button>
            <Button variant="secondary" onClick={() => viewPdf(true)}>ปริ้น PDF</Button>
          </div>

          {hasSigned ? (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-line font-medium">
                แนบหลักฐานแล้ว · {thaiDate(contract.signedAt!)}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={viewSigned}>ดูหลักฐาน</Button>
                <Button variant="danger" onClick={removeSigned} disabled={uploading}>ลบหลักฐาน</Button>
              </div>
              <label className="block">
                <span className="inline-block bg-gray-100 rounded-lg px-3 py-2 text-sm cursor-pointer">
                  {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดใหม่'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])}
                />
              </label>
            </div>
          ) : (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm text-amber-700 mb-2">ยังไม่มีหลักฐานการลงนาม — แนบไฟล์หลังปริ้นและเซ็นแล้ว</p>
              <label className="block">
                <span className="inline-flex w-full justify-center bg-line text-white rounded-xl px-4 py-3 text-sm font-medium cursor-pointer">
                  {uploading ? 'กำลังอัปโหลด...' : '+ แนบสัญญาที่ลงนามแล้ว'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])}
                />
              </label>
            </div>
          )}
          {uploadError && <p className="text-danger text-sm mt-2">{uploadError}</p>}
          <p className="text-xs text-gray-400 mt-3">รองรับ JPG, PNG หรือ PDF ขนาดไม่เกิน 15 MB</p>
        </Card>
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
