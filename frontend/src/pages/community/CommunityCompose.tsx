import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { Button, Input } from '../../components/ui'
import { useAuthStore } from '../../store/authStore'

export default function CommunityCompose() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const ownerId = params.get('ownerId') || ''
  const role = useAuthStore((s) => s.role)
  const canAnnounce = role === 'ADMIN' || role === 'OWNER'
  const [type, setType] = useState<'ANNOUNCEMENT' | 'DISCUSSION' | 'MARKETPLACE'>(
    canAnnounce ? 'ANNOUNCEMENT' : 'DISCUSSION'
  )
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [price, setPrice] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canAnnounce && type === 'ANNOUNCEMENT') setType('DISCUSSION')
  }, [canAnnounce, type])

  async function submit() {
    if (!body.trim()) {
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
      fd.append('body', body.trim())
      if (type === 'MARKETPLACE' && price) fd.append('price', price)
      if (ownerId) fd.append('ownerId', ownerId)
      files.forEach((f) => fd.append('photos', f))
      const r = await api.post('/community/posts', fd)
      nav(`/community/${r.data.id}`, { replace: true })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'โพสต์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const types = [
    ...(canAnnounce ? ([{ key: 'ANNOUNCEMENT', label: 'ประกาศ' }] as const) : []),
    { key: 'DISCUSSION', label: 'พูดคุย' },
    { key: 'MARKETPLACE', label: 'ซื้อขายของมือสอง' },
  ] as const

  return (
    <div>
      <TopBar title="โพสต์ใหม่" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {types.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                type === t.key ? 'bg-line text-white border-line' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {type === 'ANNOUNCEMENT' && (
          <Input label="หัวข้อ" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ปิดน้ำวันเสาร์" />
        )}
        {type === 'MARKETPLACE' && (
          <>
            <Input label="ชื่อสินค้า" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ตู้เย็นมือสอง" />
            <Input label="ราคา (บาท)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </>
        )}
        {type === 'DISCUSSION' && (
          <Input label="หัวข้อ (ไม่บังคับ)" value={title} onChange={(e) => setTitle(e.target.value)} />
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">ข้อความ</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[140px]"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              type === 'MARKETPLACE'
                ? 'สภาพ การใช้งาน นัดรับภายในชุมชน'
                : type === 'ANNOUNCEMENT'
                  ? 'รายละเอียดประกาศถึงลูกบ้าน'
                  : 'พูดคุย ถาม-ตอบ ของหาย'
            }
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">รูปภาพ</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))}
          />
          {files.length > 0 && <p className="text-xs text-gray-400 mt-1">เลือกแล้ว {files.length} รูป</p>}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={saving}>
          {saving ? 'กำลังโพสต์...' : 'โพสต์'}
        </Button>
      </div>
    </div>
  )
}
