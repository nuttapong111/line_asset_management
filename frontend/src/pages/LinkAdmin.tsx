import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button, Card, Input } from '../components/ui'

/**
 * Open inside LINE LIFF:
 * 1) Claim: ลงทะเบียนแอดมินใหม่ด้วย setup code (ผูก LINE ทันที)
 * 2) Bind: ผูก LINE เข้าบัญชีที่สร้างจาก /portal/register แล้ว (username/password)
 */
export default function LinkAdmin() {
  const nav = useNavigate()
  const { setAuth, user, role } = useAuthStore()
  const [mode, setMode] = useState<'bind' | 'claim'>('bind')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    setName(user?.name || '')
    api.get('/admin/claim/enabled').then((r) => setEnabled(r.data.enabled)).catch(() => setEnabled(false))
  }, [user?.name])

  async function claim() {
    if (!code.trim()) {
      setError('กรุณากรอกรหัสลงทะเบียน')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/admin/claim', { code: code.trim(), name: name.trim() || undefined })
      if (data.token && user) {
        setAuth(
          data.token,
          'ADMIN',
          { ...user, name: data.admin?.name || user.name, lineLinked: true },
          { adminId: data.admin?.id, authSource: 'liff' }
        )
      }
      nav('/admin/portfolio', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'ไม่สามารถลงทะเบียนได้')
    } finally {
      setLoading(false)
    }
  }

  async function bind() {
    if (!username.trim() || !password || !code.trim()) {
      setError('กรุณากรอก Username, Password และรหัส setup')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/bind-line', {
        username: username.trim(),
        password,
        code: code.trim(),
      })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        mustChangePassword: data.mustChangePassword,
        authSource: 'liff',
      })
      nav('/admin/portfolio', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'ผูก LINE ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  if (role === 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-line">
        <Card className="w-full max-w-sm text-center space-y-3">
          <p className="font-semibold">บัญชี LINE นี้เป็นแอดมินอยู่แล้ว</p>
          <Button onClick={() => nav('/admin/portfolio')}>เข้าสู่ระบบ</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-line">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold mb-1">ผูก LINE กับแอดมิน</h1>
          <p className="text-gray-500 text-sm">เปิดหน้านี้จากแอป LINE เท่านั้น</p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-4">
          <button
            type="button"
            className={`text-sm py-2 rounded-lg ${mode === 'bind' ? 'bg-white shadow font-semibold' : 'text-gray-500'}`}
            onClick={() => setMode('bind')}
          >
            มีบัญชี Portal แล้ว
          </button>
          <button
            type="button"
            className={`text-sm py-2 rounded-lg ${mode === 'claim' ? 'bg-white shadow font-semibold' : 'text-gray-500'}`}
            onClick={() => setMode('claim')}
          >
            สมัครใหม่
          </button>
        </div>

        {enabled === false && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">
            ระบบยังไม่เปิดให้ลงทะเบียนผู้ดูแล (ต้องตั้ง ADMIN_SETUP_CODE)
          </div>
        )}

        {mode === 'bind' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              ใช้ Username/Password ที่สมัครไว้ที่ /portal/register แล้วผูก LINE นี้เข้าบัญชีนั้น
            </p>
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input
              label="รหัสลงทะเบียน (ADMIN_SETUP_CODE)"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button onClick={bind} disabled={loading || enabled === false}>
              {loading ? 'กำลังผูก...' : 'ผูก LINE กับบัญชี Portal'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input label="ชื่อผู้ดูแล" value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อของคุณ" />
            <Input
              label="รหัสลงทะเบียน"
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="รหัสจากผู้ติดตั้งระบบ"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button onClick={claim} disabled={loading || enabled === false}>
              {loading ? 'กำลังลงทะเบียน...' : 'ยืนยันเป็นผู้ดูแล'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
