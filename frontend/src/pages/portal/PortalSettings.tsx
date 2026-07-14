import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { Button, Input } from '../../components/ui'

export default function PortalSettings() {
  const { user, role, setAuth, mustChangePassword } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState<string>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/auth/me').then((r) => {
      if (r.data.user) {
        setAuth(
          useAuthStore.getState().jwt!,
          r.data.role,
          r.data.user,
          {
            adminId: r.data.adminId,
            ownerId: r.data.ownerId,
            mustChangePassword: r.data.mustChangePassword,
            authSource: 'portal',
          }
        )
        setUsername(r.data.user.username || '')
      }
    }).catch(() => {})
  }, [])

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    setMsg(undefined)
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
        authSource: 'portal',
      })
      setCurrentPassword('')
      setNewPassword('')
      setMsg('บันทึกรหัสผ่านแล้ว')
    } catch (err: any) {
      setError(err.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-gray-500 mt-1">บัญชี Web Portal</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
        <div className="font-semibold">{user?.name}</div>
        <div className="text-sm text-gray-500">{role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'เจ้าของทรัพย์สิน'}</div>
        <div className="text-xs text-gray-400">
          LINE: {user?.lineLinked ? 'ผูกแล้ว' : 'ยังไม่ผูก — ใช้ LIFF บนมือถือไม่ได้จนกว่าจะผูกบัญชี'}
        </div>
        {mustChangePassword && (
          <p className="text-sm text-amber-600 mt-2">
            ต้องเปลี่ยนรหัสผ่านก่อน — <Link to="/portal/change-password" className="underline">ไปหน้าเปลี่ยนรหัส</Link>
          </p>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="font-semibold mb-3">Username / Password</h2>
        <form onSubmit={savePassword} className="space-y-3">
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
            label="รหัสผ่านใหม่"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัว"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {msg && <p className="text-sm text-line">{msg}</p>}
          <Button type="submit" disabled={loading || newPassword.length < 6}>
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </section>
    </div>
  )
}
