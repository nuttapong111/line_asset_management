import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button, Card } from '../components/ui'

export default function LinkRoom() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { setAuth, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function link() {
    if (!token) {
      setError('ไม่พบรหัสคำเชิญ กรุณาเปิดลิงก์จากคำเชิญที่ได้รับ')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/tenants/link', { inviteToken: token })
      if (data.token && user) {
        setAuth(data.token, 'TENANT', user, { unitId: data.tenant?.unitId })
      }
      nav('/tenant/home', { replace: true })
    } catch (e: any) {
      setError(e.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-line">
      <Card className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-line-light flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1">ยืนยันการเป็นผู้เช่า</h1>
        <p className="text-gray-500 text-sm mb-5">
          กดปุ่มด้านล่างเพื่อผูกบัญชี LINE ของคุณกับห้องพัก คุณจะได้รับใบแจ้งหนี้และข่าวสารผ่าน LINE
        </p>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <Button onClick={link} disabled={loading}>
          {loading ? 'กำลังผูกบัญชี...' : 'ยืนยันและผูก LINE'}
        </Button>
      </Card>
    </div>
  )
}
