import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { baht, thaiDate } from '../lib/utils'

type InviteInfo =
  | { type: 'owner'; name: string; propertyName: string; expired: boolean; linked: boolean }
  | {
      type: 'tenant'
      roomNumber: string
      propertyName: string
      ownerName?: string | null
      tenantName?: string | null
      rentAmount?: number | null
      startDate?: string | null
      endDate?: string | null
      dueDay?: number | null
      inviteExpiry?: string | null
      expired: boolean
    }

/**
 * Invite screen from a LIFF link (?token=...).
 * Tenants confirm on this screen before LINE linking. Owners still link automatically.
 */
export default function LinkInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const nav = useNavigate()
  const { setAuth, user, role } = useAuthStore()
  const [info, setInfo] = useState<InviteInfo>()
  const [phase, setPhase] = useState<'loading' | 'ready' | 'linking' | 'done' | 'error'>('loading')
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
    if (info?.type === 'owner' && info.linked && role === 'OWNER') {
      nav('/admin/portfolio', { replace: true })
    }
  }, [info, role, nav])

  function goHome(dest: '/admin/portfolio' | '/tenant/home') {
    nav({ pathname: dest, search: '' }, { replace: true })
  }

  async function link() {
    if (!token || !info || linkingRef.current) return
    if (info.expired) {
      setPhase('error')
      setError('ลิงก์หมดอายุแล้ว กรุณาขอใหม่จากเจ้าของห้อง')
      return
    }
    if (info.type === 'tenant' && (role === 'ADMIN' || role === 'OWNER')) {
      setPhase('error')
      setError('บัญชีนี้เป็นแอดมิน/เจ้าของ — ใช้ LINE อื่นสำหรับผู้เช่า')
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
    } catch (e: unknown) {
      linkingRef.current = false
      setPhase('error')
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'ไม่สามารถผูกบัญชีได้')
    }
  }

  useEffect(() => {
    if (!info || phase !== 'loading') return
    if (info.expired) {
      setPhase('error')
      setError('ลิงก์หมดอายุแล้ว กรุณาขอใหม่จากเจ้าของห้อง')
      return
    }
    if (info.type === 'tenant' && (role === 'ADMIN' || role === 'OWNER')) {
      setPhase('error')
      setError('บัญชีนี้เป็นแอดมิน/เจ้าของ — ใช้ LINE อื่นสำหรับผู้เช่า')
      return
    }
    if (info.type === 'owner') {
      if (role === 'OWNER' && info.linked) return
      void link()
      return
    }
    setPhase('ready')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, role])

  if (info?.type === 'tenant') {
    const busy = phase === 'linking' || phase === 'done'
    return (
      <div className="min-h-screen flex flex-col bg-hero">
        <div className="px-6 pt-12 text-white flex flex-col items-center gap-3.5 text-center">
          <div className="w-[72px] h-[72px] rounded-[22px] bg-brand text-ink flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20h14V9.5" />
              <path d="M10 20v-5h4v5" />
            </svg>
          </div>
          <span className="text-sm text-primary-soft">
            คำเชิญ{info.ownerName ? `จาก${info.ownerName}` : 'เข้าห้อง'} · {info.propertyName}
          </span>
          <h1 className="m-0 font-display text-[28px] font-bold leading-snug">
            ยินดีต้อนรับสู่
            <br />
            ห้อง {info.roomNumber}
          </h1>
        </div>
        <div className="mt-6 flex-1 bg-canvas text-ink rounded-t-[28px] px-5 py-6 flex flex-col gap-4">
          <section className="bg-white rounded-[18px] p-[18px] flex flex-col gap-2.5">
            <strong className="text-[15px]">ตรวจข้อมูลก่อนยืนยัน</strong>
            {info.tenantName && <Row k="ผู้เช่า" v={info.tenantName} />}
            <Row k="อาคาร" v={info.propertyName} />
            <Row k="ห้อง" v={info.roomNumber} />
            {info.rentAmount != null && <Row k="ค่าเช่า" v={`${baht(info.rentAmount)} / เดือน`} />}
            {info.startDate && info.endDate && (
              <Row k="สัญญา" v={`${thaiDate(info.startDate)} – ${thaiDate(info.endDate)}`} />
            )}
            {info.dueDay != null && <Row k="ครบกำหนดชำระ" v={`ทุกวันที่ ${info.dueDay}`} />}
          </section>
          <section className="flex flex-col gap-2.5">
            <strong className="text-[15px]">หลังผูกบัญชี คุณจะได้</strong>
            {['รับบิลและจ่ายผ่าน LINE ไม่ต้องสมัครสมาชิก', 'ใบเสร็จและสัญญาเก็บไว้ในที่เดียว', 'แจ้งซ่อมพร้อมรูป และติดตามสถานะได้'].map((line) => (
              <div key={line} className="flex gap-2.5 items-center text-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0" aria-hidden>
                  <path d="m5 12 5 5 9-10" />
                </svg>
                {line}
              </div>
            ))}
          </section>
          {error && <p className="text-sm text-danger bg-danger-bg rounded-card px-3 py-2">{error}</p>}
          <div className="mt-auto flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                linkingRef.current = false
                void link()
              }}
              disabled={busy || info.expired}
              className="h-[54px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50"
            >
              {phase === 'done' ? 'ผูกบัญชีสำเร็จ' : phase === 'linking' ? 'กำลังผูกบัญชี...' : 'ยืนยันและผูกบัญชี LINE'}
            </button>
            <span className="text-[13px] text-muted text-center">
              ข้อมูลไม่ถูกต้อง?{' '}
              <button type="button" className="font-bold text-primary" onClick={() => nav('/contact')}>
                ติดต่อเจ้าของ
              </button>
              {info.inviteExpiry ? ` · ลิงก์ใช้ได้ถึง ${thaiDate(info.inviteExpiry)}` : ''}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const isOwner = info?.type === 'owner'
  const roomLabel = info?.type === 'owner' ? info.propertyName : undefined

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-hero text-white">
      <div className="w-full max-w-xs text-center">
        <div className="w-16 h-16 rounded-[22px] bg-brand text-ink flex items-center justify-center mx-auto mb-5">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 10.5 12 3l9 7.5V20H3z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold">{phase === 'done' ? 'ผูกบัญชีสำเร็จ' : 'PropFlow'}</h1>
        {roomLabel && phase !== 'error' && <p className="text-primary-soft text-sm mt-2">{roomLabel}</p>}
        <p className="text-primary-soft text-sm mt-3 leading-relaxed">
          {phase === 'done'
            ? 'กำลังเปิดหน้าหลัก...'
            : phase === 'linking' || phase === 'loading'
              ? isOwner
                ? 'กำลังผูกบัญชีเจ้าของ...'
                : 'กำลังเปิดคำเชิญ...'
              : error || 'เกิดข้อผิดพลาด'}
        </p>
        {phase === 'error' && token && info && (
          <button
            type="button"
            className="mt-6 w-full h-[52px] rounded-cta bg-brand text-ink font-bold"
            onClick={() => {
              linkingRef.current = false
              setPhase('loading')
              void link()
            }}
          >
            ลองอีกครั้ง
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  )
}
