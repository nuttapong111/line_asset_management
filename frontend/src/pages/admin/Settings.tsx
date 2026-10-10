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
  const navRole = role === 'OWNER' ? 'OWNER' : 'ADMIN'
  const [richMsg, setRichMsg] = useState<string>()
  const [richLoading, setRichLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<string>()
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
      setRichMsg(
        data.ok
          ? 'อัปเดตเมนู LINE สำเร็จ (ผู้เช่า + เมนูผู้ดูแล)'
          : data.error || 'ไม่สำเร็จ'
      )
    } catch (e: any) {
      setRichMsg(e.response?.data?.error || 'ติดตั้งไม่สำเร็จ')
    } finally {
      setRichLoading(false)
    }
  }

  async function factoryReset() {
    const ok = confirm(
      'ล้างข้อมูลทั้งหมดยกเว้นบัญชีแอดมิน?\n(เจ้าของ / อาคาร / ผู้เช่า / บิล / ชุมชน จะถูกลบ)\nกด OK แล้วพิมพ์ RESET ในช่องถัดไป'
    )
    if (!ok) return
    const typed = prompt('พิมพ์ RESET เพื่อยืนยัน')
    if (typed !== 'RESET') return
    setResetLoading(true)
    setResetMsg(undefined)
    try {
      const { data } = await api.post('/admin/factory-reset', { confirm: 'RESET' })
      setResetMsg(`ล้างแล้ว เหลือแอดมิน ${data.keptAdmins} บัญชี — รีเฟรชหน้าเพื่อเริ่มเทสใหม่`)
    } catch (e: any) {
      setResetMsg(e.response?.data?.error || 'ล้างไม่สำเร็จ')
    } finally {
      setResetLoading(false)
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
      setPwdMsg('บันทึกแล้ว')
    } catch (err: any) {
      setPwdError(err.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setPwdLoading(false)
    }
  }

  const items = isAdmin
    ? [
        { label: 'การแจ้งเตือน', path: '/admin/notifications' },
        { label: 'รายงานภาพรวม', path: '/admin/reports' },
      ]
    : [
        { label: 'เทมเพลตเอกสาร', path: '/admin/document-templates' },
        { label: 'สร้างใบแจ้งหนี้', path: '/admin/invoice-builder' },
        { label: 'รายงานรายได้', path: '/admin/reports' },
        { label: 'ค่าบริการ PropFlow', path: '/admin/subscription' },
      ]

  return (
    <div className="pb-20">
      <TopBar title="ตั้งค่า" back={false} />
      <div className="p-4 space-y-3">
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-line-light flex items-center justify-center text-line font-bold text-lg">
            {user?.name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{user?.name}</div>
            <div className="text-xs text-gray-400">{isAdmin ? 'ผู้ดูแลระบบ' : 'เจ้าของทรัพย์สิน'}</div>
          </div>
        </Card>

        <details className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <summary className="px-4 py-3.5 font-medium cursor-pointer select-none">Web Portal</summary>
          <form onSubmit={savePassword} className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
            <p className="text-xs text-gray-400 break-all">{window.location.origin}/portal/login</p>
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
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
              {pwdLoading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </form>
        </details>

        <Card className="!p-0 overflow-hidden">
          {items.map((it, i) => (
            <button
              key={it.path}
              onClick={() => nav(it.path)}
              className={`w-full flex items-center justify-between px-4 py-3.5 text-left ${
                i > 0 ? 'border-t border-gray-50' : ''
              }`}
            >
              <span className="font-medium text-sm">{it.label}</span>
              <span className="text-gray-300">›</span>
            </button>
          ))}
        </Card>

        {isAdmin && (
          <>
            <Card>
              <div className="font-medium text-sm mb-1">เมนู LINE OA</div>
              <p className="text-xs text-gray-400 mb-3">
                อัปเดตเมนูผู้เช่า + เมนูแอดมิน (ค่าบริการ/เจ้าของ) + เมนู Owner (บิล/ชุมชน)
              </p>
              <Button variant="secondary" onClick={setupRichMenu} disabled={richLoading}>
                {richLoading ? 'กำลังอัปเดต...' : 'อัปเดต Rich Menu'}
              </Button>
              {richMsg && <p className="text-sm mt-2 text-gray-600">{richMsg}</p>}
            </Card>
            <Card>
              <div className="font-medium text-sm mb-1 text-danger">ล้างข้อมูลเทส</div>
              <p className="text-xs text-gray-400 mb-3">
                ลบเจ้าของ อาคาร ผู้เช่า บิล ชุมชน — เหลือเฉพาะบัญชีแอดมิน
              </p>
              <Button variant="danger" onClick={factoryReset} disabled={resetLoading}>
                {resetLoading ? 'กำลังล้าง...' : 'ล้างข้อมูล (เหลือแอดมิน)'}
              </Button>
              {resetMsg && <p className="text-sm mt-2 text-gray-600">{resetMsg}</p>}
            </Card>
          </>
        )}
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
