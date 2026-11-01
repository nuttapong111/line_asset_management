import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuthStore } from '../../store/authStore'
import { AuthImage } from '../../components/AuthImage'

export interface CommunityPost {
  id: string
  type: 'ANNOUNCEMENT' | 'DISCUSSION' | 'MARKETPLACE'
  title: string | null
  body: string
  price: number | null
  sold: boolean
  photoUrls: string[]
  pinned: boolean
  authorRole: string
  authorName: string
  roomNumber: string | null
  propertyName: string | null
  createdAt: string
  commentCount: number
}

const FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'ANNOUNCEMENT', label: 'ประกาศ' },
  { key: 'DISCUSSION', label: 'คุยกัน' },
  { key: 'MARKETPLACE', label: 'ซื้อขาย' },
]

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาที`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.`
  const d = Math.floor(h / 24)
  if (d === 1) return 'เมื่อวาน'
  return `${d} วัน`
}

function badge(p: CommunityPost) {
  if (p.type === 'ANNOUNCEMENT') {
    return { label: p.pinned ? 'ประกาศ · ปักหมุด' : 'ประกาศ', cls: 'bg-warn-bg text-warn-fg' }
  }
  if (p.type === 'MARKETPLACE') return { label: 'ซื้อขาย', cls: 'bg-info-bg text-info' }
  return { label: 'คุยกัน', cls: 'bg-surface-2 text-ink-2' }
}

function who(p: CommunityPost) {
  if (p.authorRole !== 'TENANT') return `เจ้าของ · ${ago(p.createdAt)}`
  return `${p.roomNumber || p.propertyName || 'ห้อง'} · ${ago(p.createdAt)}`
}

export default function CommunityFeed() {
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const [meta, setMeta] = useState<{
    ownerId: string
    ownerName: string
    canAnnounce: boolean
    properties?: { id: string; name: string }[]
    owners?: { id: string; name: string }[]
  }>()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [type, setType] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  function qs(nextType = type, nextOwner = ownerId) {
    const p = new URLSearchParams()
    if (nextType) p.set('type', nextType)
    if (nextOwner) p.set('ownerId', nextOwner)
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  function load(nextType = type, nextOwner = ownerId) {
    api
      .get(`/community/posts${qs(nextType, nextOwner)}`)
      .then((r) => setPosts(r.data))
      .catch((e) => setError(e.response?.data?.error || 'โหลดชุมชนไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    api
      .get('/community/meta')
      .then((r) => {
        setMeta(r.data)
        if (r.data.ownerId) setOwnerId(r.data.ownerId)
      })
      .catch(() => {})
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navRole = role === 'TENANT' ? 'TENANT' : role === 'OWNER' ? 'OWNER' : 'ADMIN'
  const place = meta?.properties?.[0]?.name || posts.find((p) => p.propertyName)?.propertyName || meta?.ownerName

  return (
    <div className="pb-28 min-h-screen bg-canvas relative">
      <div className="px-4 pt-5 flex flex-col gap-3">
        <div className="flex justify-between items-center gap-3">
          <h1 className="font-display text-[26px] font-bold m-0">ชุมชน</h1>
          {place && <span className="text-[13px] font-semibold text-muted truncate">{place}</span>}
        </div>
        {(meta?.owners?.length || 0) > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {meta!.owners!.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setOwnerId(o.id)
                  setMeta({ ...meta!, ownerId: o.id, ownerName: o.name })
                  load(type, o.id)
                }}
                className={`h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap border-[1.5px] ${
                  ownerId === o.id ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-[#DCE3DF]'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => {
            const on = type === f.key
            return (
              <button
                key={f.key || 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setType(f.key)
                  load(f.key, ownerId)
                }}
                className={`h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap border-[1.5px] ${
                  on ? 'bg-ink text-white border-ink' : 'bg-white text-ink border-[#DCE3DF]'
                }`}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {error && <p className="text-sm text-danger bg-danger-bg rounded-card px-3 py-2">{error}</p>}
        {loading && (
          <div className="flex flex-col gap-3">
            <div className="h-24 rounded-[18px] bg-surface-2" />
            <div className="h-28 rounded-[18px] bg-surface-2" />
          </div>
        )}
        {!loading &&
          posts.map((p) => {
            const tag = badge(p)
            const price =
              p.price != null
                ? '฿' + Number(p.price).toLocaleString('th-TH', { maximumFractionDigits: 0 })
                : null
            if (p.type === 'MARKETPLACE') {
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => nav(`/community/${p.id}`)}
                  className="bg-white rounded-[18px] p-4 text-left text-ink flex gap-3"
                >
                  {p.photoUrls[0] ? (
                    <AuthImage path={`/community/posts/${p.id}/photos/0`} alt="" className="w-24 h-24 rounded-xl object-cover bg-surface-2 shrink-0" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-surface-2 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${tag.cls}`}>{tag.label}</span>
                      <span className="text-xs text-muted">{who(p)}</span>
                    </div>
                    <strong className="text-[15px]">{p.title || p.body}</strong>
                    {price && (
                      <strong className={`font-display text-lg ${p.sold ? 'text-muted line-through' : 'text-primary'}`}>{price}</strong>
                    )}
                    <span className="text-[13px] text-muted">{p.commentCount} ความคิดเห็น</span>
                  </div>
                </button>
              )
            }
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => nav(`/community/${p.id}`)}
                className="bg-white rounded-[18px] px-4 py-3.5 text-left text-ink flex flex-col gap-2"
              >
                <div className="flex gap-2 items-center">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${tag.cls}`}>{tag.label}</span>
                  <span className="text-xs text-muted">{who(p)}</span>
                </div>
                <strong className="text-base">{p.title || p.body}</strong>
                {p.title && <span className="text-sm leading-normal text-ink-2 line-clamp-3">{p.body}</span>}
                <span className="text-[13px] text-muted">{p.commentCount} ความคิดเห็น</span>
              </button>
            )
          })}
        {!loading && !error && posts.length === 0 && <p className="text-center text-muted py-12">ยังไม่มีโพสต์ในหมวดนี้</p>}
      </div>
      <div className="fixed bottom-[98px] inset-x-0 z-30 max-w-liff mx-auto flex justify-end px-4 pointer-events-none">
        <button
          type="button"
          onClick={() => nav(ownerId ? `/community/new?ownerId=${ownerId}` : '/community/new')}
          className="pointer-events-auto h-[52px] px-5 rounded-full bg-primary text-white font-bold text-base shadow-fab flex items-center gap-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          โพสต์
        </button>
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
