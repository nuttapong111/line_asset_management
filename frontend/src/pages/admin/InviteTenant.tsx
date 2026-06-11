import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

interface Tenant {
  id: string
  name: string
  phone: string
  lineId?: string
  lineUserId?: string
  linkedAt?: string
  unit: { id: string; roomNumber: string; property: { name: string } }
}

export default function InviteTenant() {
  const { tenantId } = useParams()
  const nav = useNavigate()
  const [tenant, setTenant] = useState<Tenant>()
  const [inviteUrl, setInviteUrl] = useState('')
  const [status, setStatus] = useState<string>()
  const [copied, setCopied] = useState(false)

  const load = () => api.get(`/tenants/${tenantId}`).then((r) => setTenant(r.data))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  async function sendSms() {
    setStatus('กำลังส่ง SMS...')
    try {
      const { data } = await api.post(`/tenants/${tenantId}/invite/sms`)
      setInviteUrl(data.inviteUrl)
      setStatus(data.mock ? 'ส่ง SMS (โหมดทดลอง) สำเร็จ' : 'ส่ง SMS สำเร็จ')
    } catch (e: any) {
      setStatus(e.response?.data?.error || 'ส่งไม่สำเร็จ')
    }
  }

  async function sendLine() {
    setStatus('กำลังส่งผ่าน LINE...')
    try {
      await api.post(`/tenants/${tenantId}/invite/line`)
      setStatus('ส่งคำเชิญผ่าน LINE สำเร็จ')
    } catch (e: any) {
      setStatus(e.response?.data?.error || 'ส่งไม่สำเร็จ')
    }
  }

  function copy() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!tenant) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div>
      <TopBar title="ส่งคำเชิญ" />
      <div className="p-4 space-y-4">
        <Stepper step={3} />

        <Card>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{tenant.name}</h3>
              <p className="text-gray-400 text-sm">{tenant.unit.property.name} ห้อง {tenant.unit.roomNumber}</p>
              <p className="text-gray-400 text-sm">{tenant.phone}</p>
            </div>
            {tenant.linkedAt ? <Badge kind="paid">ผูกแล้ว</Badge> : <Badge kind="pending">รอผูก LINE</Badge>}
          </div>
        </Card>

        <Card>
          <h4 className="font-semibold mb-1">ส่งทาง SMS</h4>
          <p className="text-sm text-gray-400 mb-3">{tenant.phone}</p>
          <Button variant="secondary" onClick={sendSms}>ส่ง SMS</Button>
        </Card>

        <Card className="border-line">
          <h4 className="font-semibold mb-1">ส่งทาง LINE</h4>
          <p className="text-sm text-gray-400 mb-3">{tenant.lineId || 'ยังไม่ระบุ LINE ID (ต้องผูก LINE ก่อน)'}</p>
          <Button onClick={sendLine}>ส่งผ่าน LINE</Button>
        </Card>

        {inviteUrl && (
          <Card>
            <h4 className="font-semibold mb-2">ลิงก์คำเชิญ</h4>
            <div className="bg-gray-50 rounded-xl p-3 text-xs break-all text-gray-600 mb-2">{inviteUrl}</div>
            <Button variant="secondary" onClick={copy}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}</Button>
          </Card>
        )}

        {status && <p className="text-center text-sm text-gray-500">{status}</p>}

        <Button onClick={() => nav('/admin/portfolio')}>เสร็จสิ้น</Button>
      </div>
    </div>
  )
}
