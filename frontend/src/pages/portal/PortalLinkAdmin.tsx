import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'
import { Button, Input } from '../../components/ui'

/** Merge portal-only admin credentials onto the LINE admin that has the real data. */
export default function PortalLinkAdmin() {
  const nav = useNavigate()
  const { setAuth } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/link-portal-admin', { username, password, code })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        mustChangePassword: data.mustChangePassword,
        authSource: 'portal',
      })
      useAuthStore.getState().setReady(true)
      nav('/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'ผูกบัญชีไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#e8f8ee] via-[#f5f6f8] to-[#eef2ff]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="mb-6">
          <div className="text-2xl font-bold text-line">ผูก Portal กับ LINE</div>
          <p className="text-sm text-gray-500 mt-1">
            ใช้เมื่อ Portal โชว์ข้อมูลว่าง แต่ใน LINE มีข้อมูลแล้ว — จะย้าย Username/Password
            ไปยังบัญชีแอดมินที่ผูก LINE อยู่
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input
            label="Username (ที่ใช้ login Portal อยู่)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="รหัสลงทะเบียน (ADMIN_SETUP_CODE)"
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading || !username || !password || !code}>
            {loading ? 'กำลังผูกบัญชี...' : 'ผูกกับแอดมิน LINE'}
          </Button>
        </form>
        <p className="text-xs text-gray-400 mt-5 text-center">
          <Link to="/portal/login" className="text-line hover:underline">
            กลับไปเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}
