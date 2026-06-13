import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button, Card } from '../components/ui'

type InviteInfo =
  | { type: 'owner'; name: string; propertyName: string; expired: boolean; linked: boolean }
  | { type: 'tenant'; roomNumber: string; propertyName: string; expired: boolean }

/**
 * Unified invite-linking screen. The invite token itself tells us whether this
 * is an owner or a tenant invite (tokens are unique across both), so we don't
 * rely on a query param surviving the LIFF redirect.
 */
export default function LinkInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { setAuth, user } = useAuthStore()
  const [info, setInfo] = useState<InviteInfo>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!token) {
      setError('ไม่พบรหัสคำเชิญ กรุณาเปิดลิงก์จากคำเชิญที่ได้รับ')
      return
    }
    api
      .get<InviteInfo>('/invite/info', { params: { token } })
      .then(({ data }) => setInfo(data))
      .catch((e) => setError(e.response?.data?.error || 'รหัสคำเชิญไม่ถูกต้องหรือหมดอายุ'))
  }, [token])

  async function link() {
    if (!token || !info) return
    setLoading(true)
    setError(undefined)
    try {
      if (info.type === 'owner') {
        const { data } = await api.post('/owners/link', { inviteToken: token })
        if (data.token && user) setAuth(data.token, 'OWNER', user)
        nav('/admin/portfolio', { replace: true })
      } else {
        const { data } = await api.post('/tenants/link', { inviteToken: token })
        if (data.token && user) setAuth(data.token, 'TENANT', user, { unitId: data.tenant?.unitId })
        nav('/tenant/home', { replace: true })
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    } finally {
      setLoading(false)
    }
  }

  const isOwner = info?.type === 'owner'
  const title = isOwner ? 'ยืนยันการเป็นเจ้าของ' : 'ยืนยันการเป็นผู้เช่า'
  const subtitle = isOwner
    ? 'กดปุ่มด้านล่างเพื่อผูกบัญชี LINE จากนั้นคุณจะจัดการทรัพย์สิน ห้องพัก ผู้เช่า และบิลได้ผ่านระบบ'
    : 'กดปุ่มด้านล่างเพื่อผูกบัญชี LINE ของคุณกับห้องพัก คุณจะได้รับใบแจ้งหนี้และข่าวสารผ่าน LINE'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-line">
      <Card className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-line-light flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1">{title}</h1>
        {info && (
          <p className="text-gray-700 text-sm font-medium mb-1">
            {info.propertyName}
            {info.type === 'tenant' ? ` · ห้อง ${info.roomNumber}` : ''}
          </p>
        )}
        <p className="text-gray-500 text-sm mb-5">{subtitle}</p>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <Button onClick={link} disabled={loading || !info}>
          {loading ? 'กำลังผูกบัญชี...' : !info && !error ? 'กำลังโหลด...' : 'ยืนยันและผูก LINE'}
        </Button>
      </Card>
    </div>
  )
}
