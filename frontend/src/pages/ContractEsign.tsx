import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/axios'
import { openPdfViewer } from '../lib/pdfNav'
import { Button, Card, Badge } from '../components/ui'
import { TopBar } from '../components/layout/TopBar'
import { SignaturePad, type SignaturePadHandle } from '../components/SignaturePad'
import { useAuthStore } from '../store/authStore'
import { thaiDate } from '../lib/utils'

interface ContractEsignInfo {
  id: string
  status: string
  signedAt?: string | null
  landlordSignedAt?: string | null
  tenantSignedAt?: string | null
  signedDocumentUrl?: string | null
  tenant: { name: string }
  unit: { roomNumber: string; property: { name: string; owner?: { name: string } | null; admin?: { name: string } } }
}

export default function ContractEsign() {
  const { id } = useParams()
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const padRef = useRef<SignaturePadHandle | null>(null)
  const [contract, setContract] = useState<ContractEsignInfo>()
  const [hasInk, setHasInk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const load = () => api.get(`/contracts/${id}`).then((r) => setContract(r.data))
  useEffect(() => {
    load().catch(() => setError('ไม่พบสัญญา'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (error) {
    return (
      <div>
        <TopBar title="ลงนามสัญญา" />
        <p className="p-8 text-center text-gray-400">{error}</p>
      </div>
    )
  }
  if (!contract) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  const isTenant = role === 'TENANT'
  const partyLabel = isTenant ? 'ผู้เช่า' : 'ผู้ให้เช่า'
  const alreadySigned = isTenant ? Boolean(contract.tenantSignedAt) : Boolean(contract.landlordSignedAt)
  const both = Boolean(contract.landlordSignedAt && contract.tenantSignedAt)

  async function submit() {
    const dataUrl = padRef.current?.getDataUrl()
    if (!dataUrl) {
      setError('กรุณาเซ็นในช่องก่อนบันทึก')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      await api.post(`/contracts/${id}/esign`, { signaturePng: dataUrl })
      await load()
      padRef.current?.clear()
      setHasInk(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'บันทึกลายเซ็นไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const backPath = isTenant ? (id ? `/contract/${id}` : '/contract') : `/admin/contract/${id}`

  return (
    <div className="pb-8">
      <TopBar title="e-sign สัญญา" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start gap-2">
            <div>
              <h3 className="font-semibold">{contract.unit.property.name}</h3>
              <p className="text-sm text-gray-400">ห้อง {contract.unit.roomNumber}</p>
              <p className="text-sm mt-1">ผู้เช่า: {contract.tenant.name}</p>
            </div>
            <Badge kind={both ? 'paid' : 'pending'}>{both ? 'ลงนามครบ' : 'รอลงนาม'}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className={contract.landlordSignedAt ? 'text-line-dark' : 'text-amber-700'}>
              ผู้ให้เช่า: {contract.landlordSignedAt ? `เซ็นแล้ว · ${thaiDate(contract.landlordSignedAt)}` : 'ยังไม่เซ็น'}
            </div>
            <div className={contract.tenantSignedAt ? 'text-line-dark' : 'text-amber-700'}>
              ผู้เช่า: {contract.tenantSignedAt ? `เซ็นแล้ว · ${thaiDate(contract.tenantSignedAt)}` : 'ยังไม่เซ็น'}
            </div>
          </div>
        </Card>

        <Button variant="secondary" onClick={() => openPdfViewer(nav, `contracts/${id}/pdf`, { title: 'สัญญาเช่า' })}>
          ดูเนื้อหาสัญญาก่อนเซ็น
        </Button>

        <Card className="space-y-3">
          <h3 className="font-semibold">
            {alreadySigned ? `เซ็นใหม่ในฐานะ${partyLabel}` : `ลงนามในฐานะ${partyLabel}`}
          </h3>
          {alreadySigned && (
            <p className="text-sm text-line-dark">
              คุณลงนามแล้ว — เซ็นใหม่จะทับลายเซ็นเดิม
            </p>
          )}
          <p className="text-sm text-gray-500">
            ลายเซ็นจะถูกฝังลงใน PDF สัญญาอัตโนมัติ เมื่อครบทั้งผู้ให้เช่าและผู้เช่า ระบบจะถือว่าลงนามครบ
          </p>
          <SignaturePad apiRef={padRef} onChange={setHasInk} />
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button onClick={submit} disabled={!hasInk || saving}>
            {saving ? 'กำลังบันทึก...' : alreadySigned ? 'บันทึกลายเซ็นใหม่' : 'ยืนยันลายเซ็น'}
          </Button>
          {contract.signedDocumentUrl && (
            <Button
              variant="secondary"
              onClick={() => openPdfViewer(nav, `contracts/${id}/signed`, { title: 'สัญญาที่ลงนามแล้ว' })}
            >
              ดู PDF ที่ลงนามแล้ว
            </Button>
          )}
          <Button variant="ghost" onClick={() => nav(backPath)}>
            กลับหน้ารายละเอียด
          </Button>
        </Card>
      </div>
    </div>
  )
}
