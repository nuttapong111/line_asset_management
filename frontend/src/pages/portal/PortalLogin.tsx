import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { Button, Input } from '../../components/ui'

interface LoginRes {
  token: string
  role: 'ADMIN' | 'OWNER'
  mustChangePassword?: boolean
  user: { lineUserId: string; name: string; username?: string; hasPassword?: boolean; lineLinked?: boolean }
  adminId?: string
  ownerId?: string
}

export default function PortalLogin() {
  const nav = useNavigate()
  const { setAuth, hydratePortal, jwt, role, mustChangePassword, authSource } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authSource === 'portal' && jwt && (role === 'ADMIN' || role === 'OWNER')) {
      nav(mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
      return
    }
    if (hydratePortal()) {
      const s = useAuthStore.getState()
      nav(s.mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post<LoginRes>('/auth/login', { username, password })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: data.mustChangePassword,
        authSource: 'portal',
      })
      useAuthStore.getState().setReady(true)
      nav(data.mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#e8f8ee] via-[#f5f6f8] to-[#eef2ff]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-line">PropFlow</div>
          <p className="text-sm text-gray-500 mt-1">เข้าสู่ระบบ Web Portal สำหรับแอดมินและเจ้าของ</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || !username || !password}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
        <p className="text-xs text-gray-400 mt-5 text-center space-y-1">
          <span className="block">
            ยังไม่มีบัญชีแอดมิน?{' '}
            <Link to="/portal/register" className="text-line hover:underline">
              ลงทะเบียนด้วยรหัส setup
            </Link>
          </span>
          <span className="block">
            สร้างแอดมินจาก Portal แล้วยังไม่ผูก LINE? เปิดในแอป LINE:
            <br />
            <span className="text-line">เมนู / หรือลิงก์ …/link-admin</span>
          </span>
          <span className="block">
            Portal ว่างแต่ LINE มีข้อมูล?{' '}
            <Link to="/portal/link-admin" className="text-line hover:underline">
              รวมบัญชีที่นี่
            </Link>
          </span>
        </p>
      </div>
    </div>
  )
}
