import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { Button, Input } from '../../components/ui'

export default function PortalRegister() {
  const nav = useNavigate()
  const { setAuth } = useAuthStore()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/admin/claim/enabled').then((r) => setEnabled(r.data.enabled)).catch(() => setEnabled(false))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/register-admin', { name, username, password, code })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        mustChangePassword: false,
        authSource: 'portal',
      })
      useAuthStore.getState().setReady(true)
      nav('/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'ลงทะเบียนไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#e8f8ee] via-[#f5f6f8] to-[#eef2ff]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-line">ลงทะเบียนแอดมิน</div>
          <p className="text-sm text-gray-500 mt-1">สร้างบัญชี Web Portal ด้วยรหัส setup ของระบบ</p>
        </div>
        {enabled === false && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">
            ระบบยังไม่เปิดให้ลงทะเบียน (ต้องตั้ง ADMIN_SETUP_CODE)
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <Input label="ชื่อ" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อผู้ดูแล" />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัว"
          />
          <Input
            label="รหัสลงทะเบียน (ADMIN_SETUP_CODE)"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || enabled === false}>
            {loading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีแอดมิน'}
          </Button>
        </form>
        <p className="text-xs text-gray-400 mt-5 text-center">
          มีบัญชีแล้ว?{' '}
          <Link to="/portal/login" className="text-line hover:underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
