import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

const field =
  'h-12 box-border border-[1.5px] border-line-input rounded-[10px] px-3.5 font-sans text-base bg-white text-ink outline-none'

/** Merge portal-only admin credentials onto the LINE admin that has the real data. */
export default function PortalLinkAdmin() {
  const nav = useNavigate()
  const { setAuth } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/link-portal-admin', { username, password, code })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        mustChangePassword: data.mustChangePassword,
        authSource: 'portal',
      })
      useAuthStore.getState().setReady(true)
      nav('/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'ผูกบัญชีไม่สำเร็จ')
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
          <h1 className="m-0 font-display text-[clamp(32px,4vw,48px)] font-bold leading-tight">ผูก Portal กับ LINE</h1>
          <p className="m-0 text-lg leading-relaxed text-white/80">
            ใช้เมื่อมีบัญชีแอดมินใน LINE อยู่แล้ว แต่สมัคร Portal แยกจนได้บัญชีว่าง ระบบจะย้าย Username และรหัสผ่านไปบัญชี LINE นั้น
          </p>
        </div>
        <span className="text-[13px] text-white/60">ผู้เช่าไม่ต้องเข้าที่นี่ ใช้งานผ่าน LINE ได้เลย</span>
      </section>

      <section className="flex items-center justify-center box-border" style={{ flex: '1 1 420px', padding: 'clamp(24px, 5vw, 64px)' }}>
        <form onSubmit={onSubmit} className="w-full max-w-[400px] flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 font-display text-[28px] font-bold">รวมบัญชี</h2>
            <span className="text-[15px] text-muted">ใส่ Username ที่ใช้เข้า Portal และรหัส setup</span>
          </div>
          <p className="m-0 text-[13px] text-warn-fg bg-warn-bg rounded-xl p-3">
            ถ้าสร้างแอดมินจาก Portal แล้วยังไม่เคยผูก LINE ให้เปิดในแอป LINE
            {liffId ? (
              <>
                :{' '}
                <a className="font-semibold break-all" href={`https://liff.line.me/${liffId}/link-admin`}>
                  ลิงก์ผูกแอดมิน
                </a>
              </>
            ) : (
              ' ที่เส้นทาง /link-admin'
            )}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Username
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            รหัสผ่าน
            <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            รหัสลงทะเบียน
            <input className={field} type="password" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          {error && (
            <span role="alert" className="text-[13px] text-danger">
              {error}
            </span>
          )}
          <button
            type="submit"
            disabled={loading || !username || !password || !code}
            className="h-11 border-0 rounded-xl bg-primary text-white font-sans text-[17px] font-bold disabled:opacity-50"
          >
            {loading ? 'กำลังผูกบัญชี...' : 'ผูกกับแอดมิน LINE'}
          </button>
          <p className="text-[13px] text-muted text-center m-0">
            <Link to="/portal/login" className="text-primary font-semibold">
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </section>
    </div>
  )
}
