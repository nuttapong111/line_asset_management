import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button, Card, Input } from '../components/ui'

export default function LinkAdmin() {
  const nav = useNavigate()
  const { setAuth, user } = useAuthStore()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
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
        setAuth(data.token, 'ADMIN', { ...user, name: data.admin?.name || user.name }, { adminId: data.admin?.id })
      }
      nav('/admin/portfolio', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'ไม่สามารถลงทะเบียนได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-line">
      <Card className="w-full max-w-sm">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-line-light flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1">ลงทะเบียนผู้ดูแลระบบ</h1>
          <p className="text-gray-500 text-sm mb-5">
            กรอกรหัสลงทะเบียนเพื่อผูกบัญชี LINE ของคุณเป็นผู้ดูแล (แอดมิน)
          </p>
        </div>

        {enabled === false && (
          <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 mb-4">
            ระบบยังไม่เปิดให้ลงทะเบียนผู้ดูแล (ผู้ติดตั้งต้องตั้งค่า ADMIN_SETUP_CODE ก่อน)
          </div>
        )}

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
      </Card>
    </div>
  )
}
