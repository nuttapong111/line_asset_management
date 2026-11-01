import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { cls } from '../../lib/utils'

const CATS = [
  { key: 'ELECTRIC', label: 'ไฟฟ้า', d: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  { key: 'PLUMBING', label: 'ประปา', d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' },
  { key: 'APPLIANCE', label: 'เครื่องใช้', d: 'M4 5h16v11H4zM8 20h8M12 16v4' },
  { key: 'GENERAL', label: 'ทั่วไป', d: 'M4 6h16M4 12h16M4 18h10' },
] as const

export default function MaintenanceForm() {
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>('ELECTRIC')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) {
      setError('กรุณากรอกหัวข้อ')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('category', category)
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      files.forEach((f) => fd.append('photos', f))
      await api.post('/maintenance', fd)
      nav('/tenant/maintenance', { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(typeof err.response?.data?.error === 'string' ? err.response.data.error : 'ส่งไม่สำเร็จ')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas pb-28">
      <TopBar title="แจ้งซ่อม" />
      <div className="px-4 pt-4 flex flex-col gap-4">
        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
          <legend className="text-sm font-semibold mb-2">หมวด</legend>
          <div className="grid grid-cols-4 gap-2">
            {CATS.map((c) => {
              const on = category === c.key
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCategory(c.key)}
                  className={cls(
                    'h-[76px] rounded-cta flex flex-col items-center justify-center gap-1.5 text-[13px] font-semibold text-ink',
                    on ? 'border-2 border-primary bg-primary-soft' : 'border-[1.5px] border-[#DCE3DF] bg-white'
                  )}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>
                    <path d={c.d} />
                  </svg>
                  {c.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          หัวข้อ
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 box-border rounded-input border-[1.5px] border-line-input px-3.5 text-base font-normal bg-white outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          รายละเอียด
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-[84px] box-border rounded-input border-[1.5px] border-line-input px-3.5 py-3 text-[15px] leading-normal font-normal bg-white resize-none outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">รูปภาพ (ไม่บังคับ)</span>
          <div className="flex gap-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="w-[72px] h-[72px] rounded-xl bg-surface-2 overflow-hidden">
                <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            <button
              type="button"
              aria-label="เพิ่มรูป"
              onClick={() => fileRef.current?.click()}
              className="w-[72px] h-[72px] rounded-xl border-[1.5px] border-dashed border-placeholder bg-white text-primary flex items-center justify-center"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
          {files.length > 0 && <span className="text-[13px] text-muted">แนบได้สูงสุด 4 รูป</span>}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFiles((prev) => [...prev, f].slice(0, 4))
              e.target.value = ''
            }}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <div className="fixed bottom-0 inset-x-0 max-w-liff mx-auto bg-white border-t border-[#EEF1EF] px-4 pt-3 pb-6">
        <button type="button" onClick={submit} disabled={saving} className="w-full h-[52px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50">
          {saving ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งซ่อม'}
        </button>
      </div>
    </div>
  )
}
