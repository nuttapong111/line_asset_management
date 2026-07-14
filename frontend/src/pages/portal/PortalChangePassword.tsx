import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { Button, Input } from '../../components/ui'

export default function PortalChangePassword() {
  const nav = useNavigate()
  const { user, setAuth, mustChangePassword } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const needUsername = !user?.username
  const needCurrent = Boolean(user?.hasPassword) && !mustChangePassword

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/password', {
        currentPassword: needCurrent || (!mustChangePassword && user?.hasPassword) ? currentPassword : undefined,
        newPassword,
        username: needUsername || username !== user?.username ? username : undefined,
      })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: false,
        authSource: 'portal',
      })
      nav('/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f0f2f5]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm">
        <h1 className="text-xl font-bold mb-1">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm text-gray-500 mb-5">
          {mustChangePassword ? 'กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน' : 'เปลี่ยนรหัสผ่านบัญชี Portal'}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          {(needUsername || !user?.username) && (
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          {(needCurrent || (!mustChangePassword && user?.hasPassword)) && (
            <Input
              label="รหัสผ่านปัจจุบัน"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          )}
          {mustChangePassword && user?.hasPassword && (
            <Input
              label="รหัสผ่านชั่วคราว (ถ้ามี)"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="ใส่รหัสที่แอดมินให้มา"
            />
          )}
          <Input
            label="รหัสผ่านใหม่"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัว"
          />
          <Input
            label="ยืนยันรหัสผ่านใหม่"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || newPassword.length < 6}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่าน'}
          </Button>
        </form>
      </div>
    </div>
  )
}
