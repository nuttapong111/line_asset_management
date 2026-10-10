import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'

/** Legacy route — forward to unified auto-link invite screen. */
export default function LinkOwner() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()

  useEffect(() => {
    nav(token ? `/link?token=${encodeURIComponent(token)}` : '/link-room', { replace: true })
  }, [token, nav])

  return (
    <div className="min-h-screen flex items-center justify-center bg-line text-white text-sm">
      กำลังเปิดลิงก์เชิญ...
    </div>
  )
}
