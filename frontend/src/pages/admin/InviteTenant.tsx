import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { Stepper } from './_Stepper'

interface Tenant {
  id: string
  name: string
  phone: string
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
  const [linkError, setLinkError] = useState<string>()

  useEffect(() => {
    api.get(`/tenants/${tenantId}`).then(async (r) => {
      setTenant(r.data)
      try {
        const link = await api.get(`/units/${r.data.unitId}/invite-link`)
        setInviteUrl(link.data.inviteUrl)
        setLinkError(undefined)
      } catch (e: any) {
        setLinkError(e.response?.data?.error || 'สร้างลิงก์ไม่สำเร็จ')
      }
    })
  }, [tenantId])

  async function regenerate() {
    if (!tenant) return
    setLoading(true)
    setLinkError(undefined)
    try {
      const { data } = await api.get(`/units/${tenant.unitId}/invite-link`)
      setInviteUrl(data.inviteUrl)
    } catch (e: any) {
      setLinkError(e.response?.data?.error || 'สร้างลิงก์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function share() {
    if (!inviteUrl || !tenant) return
    const text = `คำเชิญผูกห้อง ${tenant.unit.property.name} ห้อง ${tenant.unit.roomNumber}\nกดลิงก์นี้ใน LINE เพื่อเชื่อมบัญชีอัตโนมัติ`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'คำเชิญผู้เช่า', text, url: inviteUrl })
        return
      } catch {
        /* cancelled */
      }
    }
    await copy()
  }

  if (!tenant) {
    return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  }

  if (tenant.linkedAt) {
    return (
      <div>
        <TopBar title="ลิงก์เชิญ" />
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-line-light text-line flex items-center justify-center text-2xl">✓</div>
          <div>
            <h2 className="text-lg font-semibold">{tenant.name}</h2>
            <p className="text-sm text-gray-500 mt-1">ผูก LINE แล้ว</p>
          </div>
          <Button onClick={() => nav('/admin/portfolio')}>เสร็จสิ้น</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="ลิงก์เชิญ" />
      <div className="p-4">
        <Stepper step={3} />
      </div>
      <div className="px-6 pb-6 flex flex-col min-h-[60vh]">
        <div className="flex-1 flex flex-col items-center text-center pt-4">
          <Badge kind="pending">รอผูก LINE</Badge>
          <h2 className="text-xl font-semibold mt-4">{tenant.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {tenant.unit.property.name} · ห้อง {tenant.unit.roomNumber}
          </p>

          <p className="text-sm text-gray-600 mt-8 max-w-xs leading-relaxed">
            ส่งลิงก์ด้านล่างให้ลูกบ้าน (แชท / SMS)
            <br />
            กดแล้วเปิดใน LINE แล้วผูกห้องอัตโนมัติ
          </p>

          <p className="mt-6 text-[11px] text-gray-400 break-all px-2 max-w-sm">
            {inviteUrl || (linkError ? '—' : 'กำลังสร้างลิงก์...')}
          </p>
          {linkError && <p className="text-danger text-sm mt-2">{linkError}</p>}
        </div>

        <div className="space-y-2 pt-4 pb-2">
          <Button onClick={share} disabled={!inviteUrl}>
            ส่งลิงก์ให้ลูกบ้าน
          </Button>
          <Button variant="secondary" onClick={copy} disabled={!inviteUrl}>
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
          </Button>
          <button
            type="button"
            onClick={regenerate}
            disabled={loading}
            className="w-full text-xs text-gray-400 py-2"
          >
            {loading ? 'กำลังสร้างใหม่...' : 'สร้างลิงก์ใหม่'}
          </button>
          <button
            type="button"
            onClick={() => nav('/admin/portfolio')}
            className="w-full text-sm text-gray-500 py-2"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
