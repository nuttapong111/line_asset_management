import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { Button } from '../components/ui'

type InviteInfo =
  | { type: 'owner'; name: string; propertyName: string; expired: boolean; linked: boolean }
  | { type: 'tenant'; roomNumber: string; propertyName: string; expired: boolean }

/**
 * Unified invite screen — opens from LIFF invite link (?token=...).
 * Auto-links when possible so the tenant only needs to open the link.
 */
export default function LinkInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { setAuth, user, role } = useAuthStore()
  const [info, setInfo] = useState<InviteInfo>()
  const [phase, setPhase] = useState<'loading' | 'linking' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string>()
  const linkingRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setPhase('error')
      setError('ไม่พบรหัสคำเชิญ กรุณาเปิดลิงก์จากเจ้าของห้อง')
      return
    }
    api
      .get<InviteInfo>('/invite/info', { params: { token } })
      .then(({ data }) => setInfo(data))
      .catch((e) => {
        setPhase('error')
        setError(e.response?.data?.error || 'ลิงก์ไม่ถูกต้องหรือหมดอายุ')
      })
  }, [token])

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
    nav({ pathname: dest, search: '' }, { replace: true })
  }

  async function link() {
    if (!token || !info || linkingRef.current) return
    if (info.type === 'owner' && info.expired) {
      setPhase('error')
      setError('ลิงก์หมดอายุแล้ว กรุณาขอใหม่จากผู้ดูแล')
      return
    }
    if (info.type === 'owner' && info.linked) {
      goHome('/admin/portfolio')
      return
    }

    linkingRef.current = true
    setPhase('linking')
    setError(undefined)
    try {
      if (info.type === 'owner') {
        const { data } = await api.post('/owners/link', { inviteToken: token })
        const authUser = user || {
          lineUserId: data.owner?.lineUserId || '',
          name: data.owner?.name || info.name || 'เจ้าของ',
        }
        if (data.token) setAuth(data.token, 'OWNER', authUser)
        setPhase('done')
        setTimeout(() => goHome('/admin/portfolio'), 600)
      } else {
        const { data } = await api.post('/tenants/link', { inviteToken: token })
        const authUser = user || {
          lineUserId: data.tenant?.lineUserId || '',
          name: data.tenant?.name || 'ผู้เช่า',
        }
        if (data.token) {
          setAuth(data.token, 'TENANT', authUser, { unitId: data.tenant?.unitId })
        }
        setPhase('done')
        setTimeout(() => goHome('/tenant/home'), 600)
      }
    } catch (e: any) {
      linkingRef.current = false
      setPhase('error')
      setError(e.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    }
  }

  // Auto-link once invite info is ready (NEW / unlinked users)
  useEffect(() => {
    if (!info || phase !== 'loading') return
    if (info.type === 'tenant' && role === 'TENANT') return
    if (info.type === 'owner' && role === 'OWNER' && info.linked) return
    if (info.type === 'owner' && info.expired) {
      setPhase('error')
      setError('ลิงก์หมดอายุแล้ว กรุณาขอใหม่จากผู้ดูแล')
      return
    }
    void link()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, role])

  const isOwner = info?.type === 'owner'
  const roomLabel =
    info?.type === 'tenant'
      ? `${info.propertyName} · ห้อง ${info.roomNumber}`
      : info?.propertyName

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-line text-white">
      <div className="w-full max-w-xs text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
          {phase === 'done' ? (
            <span className="text-3xl">✓</span>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-bold">
          {phase === 'done' ? 'ผูกบัญชีสำเร็จ' : 'PropFlow'}
        </h1>

        {roomLabel && phase !== 'error' && (
          <p className="text-white/85 text-sm mt-2">{roomLabel}</p>
        )}

        <p className="text-white/70 text-sm mt-3 leading-relaxed">
          {phase === 'done'
            ? 'กำลังเปิดหน้าหลัก...'
            : phase === 'linking' || phase === 'loading'
            ? isOwner
              ? 'กำลังผูกบัญชีเจ้าของ...'
              : 'กำลังเชื่อมบัญชีกับห้องพัก...'
            : error || 'เกิดข้อผิดพลาด'}
        </p>

        {phase === 'error' && (
          <div className="mt-6 space-y-3">
            {token && info && (
              <Button
                className="bg-white text-line hover:bg-white/90"
                onClick={() => {
                  linkingRef.current = false
                  setPhase('loading')
                  void link()
                }}
              >
                ลองอีกครั้ง
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
