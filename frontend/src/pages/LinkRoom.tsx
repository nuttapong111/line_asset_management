import { useSearchParams, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'

/**
 * Shown when a LINE user is not linked to a room yet.
 * An invite token is handed off to /link, which confirms before linking.
 */
export default function LinkRoom() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (token) nav(`/link?token=${encodeURIComponent(token)}`, { replace: true })
  }, [token, nav])

  async function retry() {
    if (!token) return
    setError(undefined)
    try {
      await api.post('/tenants/link', { inviteToken: token })
      nav('/tenant/home', { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-hero text-white">
      <div className="px-6 pt-16 flex flex-col items-center gap-3.5 text-center">
        <div className="w-[72px] h-[72px] rounded-[22px] bg-brand text-ink flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20h14V9.5" />
            <path d="M10 20v-5h4v5" />
          </svg>
        </div>
        <h1 className="font-display text-[28px] font-bold leading-snug m-0">
          {token ? 'กำลังเปิดคำเชิญ' : 'ยังไม่ได้ผูกห้อง'}
        </h1>
        <p className="text-sm text-primary-soft m-0">
          {user?.name ? `${user.name}` : 'เปิดลิงก์คำเชิญจากเจ้าของห้อง'}
        </p>
      </div>
      <div className="mt-8 flex-1 bg-canvas text-ink rounded-t-[28px] px-5 py-6">
        <p className="text-sm text-muted text-center leading-relaxed">
          {error || (token ? 'กำลังไปหน้ายืนยันคำเชิญ' : 'กรุณาเปิดลิงก์คำเชิญที่เจ้าของส่งทาง LINE หรือ SMS')}
        </p>
        {error && token && (
          <button type="button" onClick={retry} className="mt-4 w-full h-[52px] rounded-cta bg-primary text-white font-bold text-[17px]">
            ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  )
}
