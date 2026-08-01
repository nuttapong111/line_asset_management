import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Input } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { useAuth } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/axios'

export default function Settings() {
  const nav = useNavigate()
  const { user, role, setAuth } = useAuth()
  const isAdmin = role === 'ADMIN'
  const [richMsg, setRichMsg] = useState<string>()
  const [richLoading, setRichLoading] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwdMsg, setPwdMsg] = useState<string>()
  const [pwdError, setPwdError] = useState<string>()
  const [pwdLoading, setPwdLoading] = useState(false)

  async function setupRichMenu() {
    setRichLoading(true)
    setRichMsg(undefined)
    try {
      const { data } = await api.post('/admin/richmenu/setup')
      setRichMsg(data.ok ? 'เตรียม Rich Menu ผู้เช่าสำเร็จ ✓ (ผู้เช่าจะเห็นเมนูหลังผูกบัญชี LINE)' : data.error || 'ไม่สำเร็จ')
    } catch (e: any) {
      setRichMsg(e.response?.data?.error || 'ติดตั้งไม่สำเร็จ')
    } finally {
      setRichLoading(false)
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwdLoading(true)
    setPwdError(undefined)
    setPwdMsg(undefined)
    try {
      const { data } = await api.post('/auth/password', {
        username: username || undefined,
        currentPassword: user?.hasPassword ? currentPassword : undefined,
        newPassword,
      })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: false,
        authSource: useAuthStore.getState().authSource || 'liff',
        unitId: useAuthStore.getState().unitId,
      })
      setCurrentPassword('')
      setNewPassword('')
      setPwdMsg('บันทึกรหัสผ่านสำหรับ Web Portal แล้ว')
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setPwdLoading(false)
    }
  }

  const items = [
    { label: 'เทมเพลตเอกสาร', desc: 'แนบแบบฟอร์มสัญญา/ใบเสร็จ แล้วลากตัวแปรวาง', path: '/admin/document-templates' },
    { label: 'สร้างใบแจ้งหนี้', desc: 'สร้างและส่งบิลรายเดือน', path: '/admin/invoice-builder' },
    { label: 'รายงานรายได้', desc: 'สรุปรายได้และส่งออกข้อมูล', path: '/admin/reports' },
    ...(!isAdmin
      ? [{ label: 'ค่าบริการ PropFlow', desc: 'ดูวันหมดอายุ ชำระและแนบสลิป', path: '/admin/subscription' }]
      : []),
    ...(isAdmin
      ? [
          { label: 'จัดการเจ้าของ', desc: 'เชิญ/มอบหมายทรัพย์สินให้เจ้าของ', path: '/admin/owners' },
          { label: 'บิลค่าบริการ Owner', desc: 'อนุมัติสลิปต่ออายุสมาชิก', path: '/admin/subscriptions' },
          { label: 'การแจ้งเตือน', desc: 'ตั้งค่าใบแจ้งหนี้ เตือนค่าเช่า ฯลฯ', path: '/admin/notifications' },
        ]
      : []),
  ]

  return (
    <div className="pb-20">
      <TopBar title="ตั้งค่า" back={false} />
      <div className="p-4 space-y-4">
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-line-light flex items-center justify-center text-line font-bold">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{user?.name}</div>
            <div className="text-xs text-gray-400">{isAdmin ? 'ผู้ดูแลระบบ' : 'เจ้าของทรัพย์สิน'}</div>
            <div
              className="text-[10px] text-gray-300 truncate"
              onClick={() => user?.lineUserId && navigator.clipboard.writeText(user.lineUserId)}
            >
              {user?.lineUserId}
            </div>
          </div>
        </Card>

        <Card>
          <div className="font-medium mb-1">Web Portal (คอม)</div>
          <div className="text-xs text-gray-400 mb-3">
            ตั้ง Username/Password เพื่อเข้า{' '}
            <span className="text-line">{window.location.origin}/portal/login</span>
          </div>
          <form onSubmit={savePassword} className="space-y-2">
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
            {user?.hasPassword && (
              <Input
                label="รหัสผ่านปัจจุบัน"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            )}
            <Input
              label={user?.hasPassword ? 'รหัสผ่านใหม่' : 'ตั้งรหัสผ่าน'}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัว"
            />
            {pwdError && <p className="text-danger text-sm">{pwdError}</p>}
            {pwdMsg && <p className="text-line text-sm">{pwdMsg}</p>}
            <Button type="submit" disabled={pwdLoading || !username || newPassword.length < 6}>
              {pwdLoading ? 'กำลังบันทึก...' : 'บันทึกรหัส Portal'}
            </Button>
          </form>
        </Card>

        {items.map((it) => (
          <Card key={it.path} onClick={() => nav(it.path)} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{it.label}</div>
              <div className="text-xs text-gray-400">{it.desc}</div>
            </div>
            <span className="text-gray-300">›</span>
          </Card>
        ))}

        {isAdmin && (
          <Card>
            <div className="font-medium">Rich Menu ผู้เช่า (LINE OA)</div>
            <div className="text-xs text-gray-400 mb-3">
              เตรียม/อัปเดตเมนูลัด 6 ปุ่มสำหรับผู้เช่า — ระบบจะผูกเมนูนี้ให้ผู้เช่าอัตโนมัติหลังผูกบัญชี LINE
            </div>
            <Button variant="secondary" onClick={setupRichMenu} disabled={richLoading}>
              {richLoading ? 'กำลังเตรียม...' : 'เตรียม / อัปเดต Rich Menu ผู้เช่า'}
            </Button>
            {richMsg && <p className="text-sm mt-2 text-gray-600">{richMsg}</p>}
          </Card>
        )}
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
