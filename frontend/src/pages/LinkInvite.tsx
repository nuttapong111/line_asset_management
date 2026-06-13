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
  const { setAuth, user, role } = useAuthStore()
  const [info, setInfo] = useState<InviteInfo>()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
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

  // Already linked on a previous visit — skip the confirm screen
  useEffect(() => {
    if (!info) return
    if (info.type === 'owner' && info.linked && role === 'OWNER') {
      nav('/admin/portfolio', { replace: true })
    }
    if (info.type === 'tenant' && role === 'TENANT') {
      nav('/tenant/home', { replace: true })
    }
  }, [info, role, nav])

  function goHome(dest: '/admin/portfolio' | '/tenant/home') {
    // Explicitly drop ?token= from the URL so App.tsx won't bounce back here
    nav({ pathname: dest, search: '' }, { replace: true })
  }

  async function link() {
    if (!token || !info) return
    if (info.type === 'owner' && info.expired) {
      setError('ลิงก์คำเชิญหมดอายุแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแล')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      if (info.type === 'owner') {
        const { data } = await api.post('/owners/link', { inviteToken: token })
        const authUser = user || {
          lineUserId: data.owner?.lineUserId || '',
          name: data.owner?.name || info.name || 'เจ้าของ',
        }
        if (data.token) setAuth(data.token, 'OWNER', authUser)
        setDone(true)
        setTimeout(() => goHome('/admin/portfolio'), 800)
      } else {
        const { data } = await api.post('/tenants/link', { inviteToken: token })
        const authUser = user || {
          lineUserId: data.tenant?.lineUserId || '',
          name: data.tenant?.name || 'ผู้เช่า',
        }
        if (data.token) {
          setAuth(data.token, 'TENANT', authUser, { unitId: data.tenant?.unitId })
        }
        setDone(true)
        setTimeout(() => goHome('/tenant/home'), 800)
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    } finally {
      setLoading(false)
    }
  }

  const isOwner = info?.type === 'owner'
  const title = done
    ? 'ผูกบัญชีสำเร็จ!'
    : isOwner
    ? 'ยืนยันการเป็นเจ้าของ'
    : 'ยืนยันการเป็นผู้เช่า'
  const subtitle = done
    ? 'กำลังเปิดระบบจัดการ...'
    : isOwner
    ? 'กดปุ่มด้านล่างเพื่อผูกบัญชี LINE จากนั้นคุณจะจัดการทรัพย์สิน ห้องพัก ผู้เช่า และบิลได้ผ่านระบบ'
    : 'กดปุ่มด้านล่างเพื่อผูกบัญชี LINE ของคุณกับห้องพัก คุณจะได้รับใบแจ้งหนี้และข่าวสารผ่าน LINE'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-line">
      <Card className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-line-light flex items-center justify-center mx-auto mb-4">
          {done ? (
            <span className="text-3xl">✓</span>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#06C755" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          )}
        </div>
        <h1 className="text-xl font-bold mb-1">{title}</h1>
        {info && !done && (
          <p className="text-gray-700 text-sm font-medium mb-1">
            {info.propertyName}
            {info.type === 'tenant' ? ` · ห้อง ${info.roomNumber}` : ''}
          </p>
        )}
        <p className="text-gray-500 text-sm mb-5">{subtitle}</p>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        {!done && (
          <Button onClick={link} disabled={loading || !info || (isOwner && info?.type === 'owner' && info.linked)}>
            {loading
              ? 'กำลังผูกบัญชี...'
              : !info && !error
              ? 'กำลังโหลด...'
              : isOwner && info?.type === 'owner' && info.linked
              ? 'ผูกแล้ว — กำลังเปิดระบบ...'
              : 'ยืนยันและผูก LINE'}
          </Button>
        )}
      </Card>
    </div>
  )
}
