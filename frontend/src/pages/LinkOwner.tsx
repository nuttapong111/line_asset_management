import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button, Card } from '../components/ui'

export default function LinkOwner() {
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
      const { data } = await api.post('/owners/link', { inviteToken: token })
      if (data.token && user) {
        setAuth(data.token, 'OWNER', user)
      }
      nav('/owner/home', { replace: true })
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
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1">ยืนยันการเป็นเจ้าของ</h1>
        <p className="text-gray-500 text-sm mb-5">
          กดปุ่มด้านล่างเพื่อผูกบัญชี LINE คุณจะได้รับแจ้งเตือนเมื่อผู้เช่าชำระเงินหรือมีรายการแจ้งซ่อม
        </p>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <Button onClick={link} disabled={loading}>
          {loading ? 'กำลังผูกบัญชี...' : 'ยืนยันและผูก LINE'}
        </Button>
      </Card>
    </div>
  )
}
