import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { cls } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

const TYPES = [
  { key: 'ANNOUNCEMENT' as const, label: 'ประกาศ', hint: 'เฉพาะเจ้าของ' },
  { key: 'DISCUSSION' as const, label: 'คุยกัน' },
  { key: 'MARKETPLACE' as const, label: 'ซื้อขาย' },
]

export default function CommunityCompose() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const ownerId = params.get('ownerId') || ''
  const role = useAuthStore((s) => s.role)
  const canAnnounce = role === 'ADMIN' || role === 'OWNER'
  const [type, setType] = useState<(typeof TYPES)[number]['key']>(canAnnounce ? 'ANNOUNCEMENT' : 'DISCUSSION')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [price, setPrice] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [place, setPlace] = useState('ชุมชน')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u))
  }, [previews])

  useEffect(() => {
    if (!canAnnounce && type === 'ANNOUNCEMENT') setType('DISCUSSION')
  }, [canAnnounce, type])

  useEffect(() => {
    api
      .get('/community/meta', { params: ownerId ? { ownerId } : {} })
      .then((r) => setPlace(r.data?.properties?.[0]?.name || r.data?.ownerName || 'ชุมชน'))
      .catch(() => {})
  }, [ownerId])

  async function submit() {
    if (!body.trim() && !title.trim()) {
      setError('กรุณากรอกข้อความ')
      return
    }
    if (type === 'MARKETPLACE' && (!title.trim() || !price)) {
      setError('กรุณาใส่ชื่อสินค้าและราคา')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const fd = new FormData()
      fd.append('type', type)
      if (title.trim()) fd.append('title', title.trim())
      fd.append('body', (body.trim() || title.trim()))
      if (type === 'MARKETPLACE' && price) fd.append('price', price)
      if (ownerId) fd.append('ownerId', ownerId)
      files.slice(0, 4).forEach((f) => fd.append('photos', f))
      const r = await api.post('/community/posts', fd)
      nav(`/community/${r.data.id}`, { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'โพสต์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas pb-28">
      <TopBar title="สร้างโพสต์" />
      <div className="px-4 pt-4 flex flex-col gap-4">
        <fieldset className="m-0 p-0 border-0">
          <legend className="text-sm font-semibold mb-2">ประเภท</legend>
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const locked = t.key === 'ANNOUNCEMENT' && !canAnnounce
              const on = type === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={on}
                  disabled={locked}
                  onClick={() => setType(t.key)}
                  className={cls(
                    'h-16 rounded-cta text-sm flex flex-col items-center justify-center gap-0.5',
                    locked && 'text-muted',
                    on ? 'border-2 border-primary bg-primary-soft font-bold text-ok-fg' : 'border-[1.5px] border-[#DCE3DF] bg-white font-semibold',
                    !on && !locked && 'text-ink'
                  )}
                >
                  {t.label}
                  {t.hint && <span className="text-[11px] font-normal text-muted">{t.hint}</span>}
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
        {type === 'MARKETPLACE' && (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            ราคา (บาท)
            <input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              className="h-12 box-border rounded-input border-[1.5px] border-line-input px-3.5 font-display text-lg font-semibold bg-white outline-none focus:border-primary"
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          รายละเอียด
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-24 box-border rounded-input border-[1.5px] border-line-input px-3.5 py-3 text-[15px] leading-normal font-normal bg-white resize-none outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            รูปภาพ <span className="font-normal text-muted">(สูงสุด 4 รูป · {files.length}/4)</span>
          </span>
          <div className="grid grid-cols-4 gap-2">
            {previews.map((src, i) => (
              <div key={src} className="aspect-square rounded-xl bg-surface-2 overflow-hidden">
                <img src={src} alt={`รูป ${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
            {files.length < 4 && (
              <label aria-label="เพิ่มรูป" className="aspect-square rounded-xl border-[1.5px] border-dashed border-placeholder bg-white text-primary flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || [])
                    setFiles((prev) => [...prev, ...picked].slice(0, 4))
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
      <div className="fixed bottom-0 inset-x-0 max-w-liff mx-auto bg-white border-t border-[#EEF1EF] px-4 pt-3 pb-6">
        <button type="button" onClick={submit} disabled={saving} className="w-full h-[52px] rounded-cta bg-primary text-white font-bold text-[17px] disabled:opacity-50">
          {saving ? 'กำลังโพสต์...' : `โพสต์ใน${place}`}
        </button>
      </div>
    </div>
  )
}
