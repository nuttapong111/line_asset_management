import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

interface LoginRes {
  token: string
  role: 'ADMIN' | 'OWNER'
  mustChangePassword?: boolean
  user: { lineUserId: string; name: string; username?: string; hasPassword?: boolean; lineLinked?: boolean }
  adminId?: string
  ownerId?: string
}

const field =
  'h-12 box-border border-[1.5px] rounded-[10px] px-3.5 font-sans text-base bg-white text-ink outline-none'

export default function PortalLogin() {
  const nav = useNavigate()
  const { setAuth, hydratePortal, jwt, role, mustChangePassword, authSource } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined
  const lineHref = liffId ? `https://liff.line.me/${liffId}` : undefined

  useEffect(() => {
    if (authSource === 'portal' && jwt && (role === 'ADMIN' || role === 'OWNER')) {
      nav(mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
      return
    }
    if (hydratePortal()) {
      const s = useAuthStore.getState()
      nav(s.mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post<LoginRes>('/auth/login', { username, password })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: data.mustChangePassword,
        authSource: 'portal',
      })
      useAuthStore.getState().setReady(true)
      nav(data.mustChangePassword ? '/portal/change-password' : '/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'รหัสผ่านไม่ถูกต้อง ลองอีกครั้ง หรือติดต่อแอดมินให้รีเซ็ต')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex flex-wrap">
      <section
        className="bg-hero text-white flex flex-col justify-between gap-10 box-border"
        style={{ flex: '1 1 420px', padding: 'clamp(32px, 6vw, 80px)' }}
      >
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20h14V9.5" />
            </svg>
          </span>
          <strong className="font-display text-[22px]">PropFlow</strong>
        </div>
        <div className="flex flex-col gap-4 max-w-[520px]">
          <h1 className="m-0 font-display text-[clamp(32px,4vw,48px)] font-bold leading-tight">
            จัดการบ้านเช่าทุกห้อง
            <br />
            จากที่เดียว
          </h1>
          <p className="m-0 text-lg leading-relaxed text-white/80">
            ผู้เช่าจ่ายผ่าน LINE คุณตรวจสลิป ออกใบเสร็จ และดูรายรับได้ทันที
          </p>
        </div>
        <span className="text-[13px] text-white/60">ผู้เช่าไม่ต้องเข้าที่นี่ ใช้งานผ่าน LINE ได้เลย</span>
      </section>

      <section className="flex items-center justify-center box-border" style={{ flex: '1 1 420px', padding: 'clamp(24px, 5vw, 64px)' }}>
        <form onSubmit={onSubmit} className="w-full max-w-[400px] flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-display text-[28px] font-bold">เข้าสู่ระบบ</h2>
            <span className="text-[15px] text-muted">สำหรับเจ้าของและแอดมิน</span>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Username
            <input
              className={`${field} border-line-input`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            รหัสผ่าน
            <input
              type="password"
              className={`${field} ${error ? 'border-danger' : 'border-line-input'}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <span role="alert" className="-mt-2.5 text-[13px] text-danger">
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="h-11 border-0 rounded-xl bg-primary text-white font-sans text-[17px] font-bold disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
          <div className="flex items-center gap-3 text-muted text-[13px]">
            <span className="flex-1 h-px bg-line-soft" />
            หรือ
            <span className="flex-1 h-px bg-line-soft" />
          </div>
          {lineHref ? (
            <a
              href={lineHref}
              className="h-11 rounded-xl border-[1.5px] border-line-soft bg-white text-ink no-underline text-base font-semibold flex items-center justify-center gap-2.5"
            >
              <span className="w-[22px] h-[22px] rounded-md bg-brand" />
              เปิดใน LINE (มือถือ)
            </a>
          ) : (
            <span className="h-11 rounded-xl border-[1.5px] border-line-soft bg-white text-muted text-base font-semibold flex items-center justify-center gap-2.5">
              <span className="w-[22px] h-[22px] rounded-md bg-brand" />
              เปิดใน LINE (มือถือ)
            </span>
          )}
          <p className="text-[13px] text-muted text-center m-0 flex flex-col gap-1">
            <span>
              ยังไม่มีบัญชีแอดมิน?{' '}
              <Link to="/portal/register" className="text-primary font-semibold">
                ลงทะเบียนด้วยรหัส setup
              </Link>
            </span>
            <span>
              Portal ว่างแต่ LINE มีข้อมูล?{' '}
              <Link to="/portal/link-admin" className="text-primary font-semibold">
                รวมบัญชีที่นี่
              </Link>
            </span>
          </p>
        </form>
      </section>
    </div>
  )
}
