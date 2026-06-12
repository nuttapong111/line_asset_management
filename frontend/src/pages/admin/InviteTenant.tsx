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
  linkedAt?: string
  unitId: string
  unit: { id: string; roomNumber: string; property: { name: string } }
}

export default function InviteTenant() {
  const { tenantId } = useParams()
  const nav = useNavigate()
  const [tenant, setTenant] = useState<Tenant>()
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get(`/tenants/${tenantId}`).then(async (r) => {
      setTenant(r.data)
      // auto-generate the invite link for this unit
      try {
        const link = await api.get(`/units/${r.data.unitId}/invite-link`)
        setInviteUrl(link.data.inviteUrl)
      } catch {
        /* ignore */
      }
    })
  }, [tenantId])

  async function regenerate() {
    if (!tenant) return
    setLoading(true)
    try {
      const { data } = await api.get(`/units/${tenant.unitId}/invite-link`)
      setInviteUrl(data.inviteUrl)
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function share() {
    if (!inviteUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: 'คำเชิญผู้เช่า PropFlow', text: 'กดลิงก์เพื่อผูกบัญชี LINE', url: inviteUrl })
      } catch {
        /* user cancelled */
      }
    } else {
      copy()
    }
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
          <h4 className="font-semibold mb-1">ลิงก์คำเชิญ</h4>
          <p className="text-sm text-gray-500 mb-3">
            คัดลอกลิงก์นี้แล้วส่งให้ผู้เช่าทาง <span className="font-medium text-line">LINE OA</span> ของคุณได้เลย
            เมื่อผู้เช่ากดลิงก์และยืนยัน ระบบจะผูกบัญชี LINE และแจ้งเตือนคุณอัตโนมัติ
          </p>
          <div className="bg-gray-50 rounded-xl p-3 text-xs break-all text-gray-600 mb-3 min-h-[3rem]">
            {inviteUrl || 'กำลังสร้างลิงก์...'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={copy} disabled={!inviteUrl}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}</Button>
            <Button variant="secondary" onClick={share} disabled={!inviteUrl}>แชร์</Button>
          </div>
          <button onClick={regenerate} disabled={loading} className="text-xs text-gray-400 mt-3 w-full">
            {loading ? 'กำลังสร้างใหม่...' : 'สร้างลิงก์ใหม่ (รีเซ็ตอายุ 7 วัน)'}
          </button>
        </Card>

        <div className="bg-line-light rounded-xl p-3 text-sm text-line-dark">
          💡 ลิงก์มีอายุ 7 วัน หากผู้เช่ายังไม่ได้กด สามารถกด "สร้างลิงก์ใหม่" แล้วส่งซ้ำได้
        </div>

        <Button onClick={() => nav('/admin/portfolio')}>เสร็จสิ้น</Button>
      </div>
    </div>
  )
}
