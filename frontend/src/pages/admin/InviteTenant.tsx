import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import api from '../../lib/axios'
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

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, '')
  if (d.length < 4) return phone
  return `${d.slice(0, 2)}x-xxx-${d.slice(-4)}`
}

export default function InviteTenant() {
  const { tenantId } = useParams()
  const nav = useNavigate()
  const [tenant, setTenant] = useState<Tenant>()
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [sms, setSms] = useState(true)
  const [line, setLine] = useState(false)
  const [loading, setLoading] = useState(false)
  const [linkError, setLinkError] = useState<string>()
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api.get(`/tenants/${tenantId}`).then(async (r) => {
      setTenant(r.data)
      try {
        const link = await api.get(`/units/${r.data.unitId}/invite-link`)
        setInviteUrl(link.data.inviteUrl)
        setLinkError(undefined)
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        setLinkError(typeof msg === 'string' ? msg : 'สร้างลิงก์ไม่สำเร็จ')
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
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setLinkError(typeof msg === 'string' ? msg : 'สร้างลิงก์ไม่สำเร็จ')
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

  async function send() {
    if (!inviteUrl || !tenant) return
    const text = `สวัสดี${tenant.name}\n${tenant.unit.property.name}เชิญคุณผูกห้อง ${tenant.unit.roomNumber} กับ LINE เพื่อรับบิลและจ่ายค่าเช่าออนไลน์\n${inviteUrl}\nลิงก์ใช้ได้ 7 วัน`
    if ((sms || line) && navigator.share) {
      try {
        await navigator.share({ title: 'คำเชิญผู้เช่า', text })
      } catch {
        /* cancelled */
      }
    } else {
      await copy()
    }
    setSent(true)
  }

  if (!tenant) {
    return (
      <div>
        <TopBar title="รับผู้เช่า" />
        <div className="p-4"><div className="h-28 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  if (tenant.linkedAt) {
    return (
      <div>
        <TopBar title={`รับผู้เช่า · ห้อง ${tenant.unit.roomNumber}`} sub={tenant.name} />
        <div className="p-6 text-center flex flex-col gap-3">
          <p className="font-semibold">{tenant.name} ผูก LINE แล้ว</p>
          <button type="button" className="h-[52px] rounded-cta bg-primary text-white font-bold" onClick={() => nav('/admin/portfolio')}>
            เสร็จสิ้น
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <TopBar title={`รับผู้เช่า · ห้อง ${tenant.unit.roomNumber}`} sub={tenant.name} />
      <div className="px-4 py-3.5 flex flex-col gap-3.5">
        <Stepper step={3} />
        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2.5">
          <strong className="text-sm">ส่งทาง</strong>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={sms} onChange={(e) => setSms(e.target.checked)} />
            <span className="flex-1">SMS ไปที่ {maskPhone(tenant.phone)}</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={line} onChange={(e) => setLine(e.target.checked)} />
            <span className="flex-1">LINE (ผู้เช่ายังไม่ได้เพิ่มเพื่อน)</span>
          </label>
          <p className="text-xs text-muted">ระบบเปิดแผงแชร์ของเครื่องให้ส่งข้อความนี้ — ลิงก์สร้างจากคำเชิญของห้อง</p>
        </section>

        <section className="flex flex-col gap-2">
          <strong className="text-sm">ตัวอย่างข้อความ</strong>
          <div className="bg-segment rounded-[18px] p-3.5">
            <div className="bg-white rounded-[16px] rounded-bl-[4px] px-3.5 py-3 text-sm leading-relaxed">
              สวัสดี{tenant.name}
              <br />
              {tenant.unit.property.name}เชิญคุณผูกห้อง {tenant.unit.roomNumber} กับ LINE เพื่อรับบิลและจ่ายค่าเช่าออนไลน์
              <br />
              <span className="text-primary font-bold break-all">{inviteUrl || 'กำลังสร้างลิงก์...'}</span>
              <br />
              <span className="text-xs text-muted">ลิงก์ใช้ได้ 7 วัน</span>
            </div>
          </div>
          {linkError && <p className="text-[13px] text-danger">{linkError}</p>}
        </section>

        <section className="bg-white rounded-card p-3.5 flex items-center gap-3.5">
          <div className="w-[84px] h-[84px] rounded-[10px] border border-line-soft bg-white flex items-center justify-center" role="img" aria-label="QR คำเชิญ">
            {inviteUrl ? <QRCodeSVG value={inviteUrl} size={72} /> : <span className="text-[11px] text-muted">QR</span>}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <strong className="text-sm">อยู่ด้วยกันตอนนี้?</strong>
            <span className="text-[13px] text-muted">ให้ผู้เช่าสแกน QR นี้ด้วยกล้อง LINE</span>
            <button type="button" className="self-start text-sm font-bold text-primary" onClick={copy} disabled={!inviteUrl}>
              {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </button>
            <button type="button" className="self-start text-xs text-muted" onClick={regenerate} disabled={loading}>
              {loading ? 'กำลังสร้างใหม่...' : 'สร้างลิงก์ใหม่'}
            </button>
          </div>
        </section>
        {sent && <p className="text-sm text-ok-fg">บันทึกคำเชิญแล้ว — ส่งลิงก์ให้ผู้เช่าได้จากข้อความด้านบน</p>}
      </div>
      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6">
        <button type="button" className="w-full h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold disabled:opacity-50" onClick={send} disabled={!inviteUrl}>
          ส่งคำเชิญและบันทึก
        </button>
      </div>
    </div>
  )
}
