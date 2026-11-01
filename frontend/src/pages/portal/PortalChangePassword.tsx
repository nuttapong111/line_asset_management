import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

const field =
  'h-12 box-border border-[1.5px] border-line-input rounded-[10px] px-3.5 font-sans text-base text-ink outline-none focus:border-primary'

export default function PortalChangePassword() {
  const nav = useNavigate()
  const { user, role, setAuth, mustChangePassword } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const needUsername = !user?.username
  const needCurrent = Boolean(user?.hasPassword) && !mustChangePassword

  const longEnough = newPassword.length >= 8
  const hasNumber = /\d/.test(newPassword)
  const notSame = newPassword.length > 0 && newPassword !== currentPassword
  const score = [newPassword.length >= 8, hasNumber, notSame, newPassword.length >= 12].filter(Boolean).length

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    if (newPassword !== confirm) {
      setError('รหัสผ่านใหม่ไม่ตรงกัน')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { data } = await api.post('/auth/password', {
        currentPassword: needCurrent || currentPassword ? currentPassword : undefined,
        newPassword,
        username: needUsername || username !== user?.username ? username : undefined,
      })
      setAuth(data.token, data.role, data.user, {
        adminId: data.adminId,
        ownerId: data.ownerId,
        mustChangePassword: false,
        authSource: 'portal',
      })
      nav('/portal', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen box-border bg-canvas text-ink font-sans flex items-center justify-center px-4 py-6">
      <form onSubmit={onSubmit} className="w-full max-w-[440px] box-border bg-white rounded-3xl p-[clamp(24px,4vw,40px)] flex flex-col gap-[18px]">
        <span className="w-[52px] h-[52px] rounded-[14px] bg-ok-bg flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[26px] font-bold">ตั้งรหัสผ่านใหม่</h1>
          <span className="text-[15px] leading-relaxed text-muted">
            {mustChangePassword
              ? 'นี่คือการเข้าใช้ครั้งแรก กรุณาเปลี่ยนรหัสชั่วคราวก่อนเริ่มใช้งาน'
              : 'เปลี่ยนรหัสผ่านบัญชี Portal'}
          </span>
        </div>
        {needUsername && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Username
            <input className={field} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
        )}
        {(needCurrent || (mustChangePassword && user?.hasPassword)) && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {mustChangePassword ? 'รหัสผ่านชั่วคราว' : 'รหัสผ่านปัจจุบัน'}
            <input
              type="password"
              className={field}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          รหัสผ่านใหม่
          <input
            type="password"
            className={`${field} ${newPassword && longEnough ? 'border-primary' : ''}`}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <div className="flex gap-1" aria-label="ความแข็งแรงของรหัส">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`flex-1 h-1 rounded ${i < score ? 'bg-primary' : 'bg-line-soft'}`} />
          ))}
        </div>
        <div className="flex flex-col gap-1 text-[13px] -mt-1.5">
          <span className={longEnough ? 'text-ok-fg' : 'text-muted'}>{longEnough ? '✓' : '○'} อย่างน้อย 8 ตัวอักษร</span>
          <span className={hasNumber ? 'text-ok-fg' : 'text-muted'}>{hasNumber ? '✓' : '○'} มีตัวเลข</span>
          <span className={notSame ? 'text-ok-fg' : 'text-muted'}>{notSame ? '✓' : '○'} ไม่ซ้ำกับรหัสชั่วคราว</span>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          ยืนยันรหัสผ่าน
          <input
            type="password"
            className={field}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {error && <p className="m-0 text-[13px] text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading || !longEnough || !hasNumber || newPassword !== confirm}
          className="h-11 border-0 rounded-xl bg-primary text-white font-sans text-[17px] font-bold disabled:opacity-50"
        >
          {loading ? 'กำลังบันทึก...' : mustChangePassword ? 'บันทึกและเริ่มใช้งาน' : 'บันทึกรหัสผ่าน'}
        </button>
        {mustChangePassword && role === 'OWNER' && (
          <span className="text-[13px] text-muted text-center">ระบบจะเริ่มนับวันทดลองใช้จากการเข้าใช้ครั้งนี้</span>
        )}
      </form>
    </div>
  )
}
