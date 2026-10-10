import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui'

/**
 * Fallback when a NEW LINE user opens the OA/LIFF without an invite token.
 * With a token, redirects to /link for auto-connect.
 */
export default function LinkRoom() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { setAuth, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (token) {
      nav(`/link?token=${encodeURIComponent(token)}`, { replace: true })
    }
  }, [token, nav])

  async function link() {
    if (!token) return
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

  if (token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-line text-white">
        <p className="text-white/80 text-sm">{loading ? 'กำลังเชื่อมบัญชี...' : 'กำลังเปิดลิงก์เชิญ...'}</p>
        {error && (
          <div className="mt-4 text-center space-y-3">
            <p className="text-sm text-white/90">{error}</p>
            <Button className="bg-white text-line" onClick={link}>
              ลองอีกครั้ง
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-line text-white">
      <div className="w-full max-w-xs text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">PropFlow</h1>
        <p className="text-white/80 text-sm mt-3 leading-relaxed">
          ยังไม่ได้ผูกห้องพัก
          <br />
          กรุณาเปิดลิงก์คำเชิญจากเจ้าของห้อง
        </p>
      </div>
    </div>
  )
}
