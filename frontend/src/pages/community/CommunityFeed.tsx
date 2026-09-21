import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Badge } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { baht, thaiDateTime } from '../../lib/utils'
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
  { key: 'DISCUSSION', label: 'พูดคุย' },
  { key: 'MARKETPLACE', label: 'ซื้อขาย' },
]

const typeLabel: Record<string, string> = {
  ANNOUNCEMENT: 'ประกาศ',
  DISCUSSION: 'พูดคุย',
  MARKETPLACE: 'ซื้อขาย',
}

export default function CommunityFeed() {
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const [meta, setMeta] = useState<{ ownerId: string; ownerName: string; canAnnounce: boolean; owners?: { id: string; name: string }[] }>()
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
    api.get('/community/meta').then((r) => {
      setMeta(r.data)
      if (r.data.ownerId) setOwnerId(r.data.ownerId)
    }).catch(() => {})
    load('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navRole = role === 'TENANT' ? 'TENANT' : 'ADMIN'

  return (
    <div className="pb-24 min-h-screen bg-[#f3f4f6]">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">ชุมชน</div>
            <h1 className="font-semibold text-lg leading-tight truncate max-w-[220px]">
              {meta?.ownerName || 'ลูกบ้าน'}
            </h1>
          </div>
          <button
            onClick={() => nav(ownerId ? `/community/new?ownerId=${ownerId}` : '/community/new')}
            className="bg-line text-white text-sm font-medium rounded-full px-4 py-2"
          >
            + โพสต์
          </button>
        </div>
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {(meta?.owners?.length || 0) > 1 &&
            meta!.owners!.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setOwnerId(o.id)
                  setMeta({ ...meta!, ownerId: o.id, ownerName: o.name })
                  load(type, o.id)
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                  ownerId === o.id ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {o.name}
              </button>
            ))}
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              onClick={() => {
                setType(f.key)
                load(f.key, ownerId)
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border ${
                type === f.key ? 'bg-line text-white border-line' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {error && <p className="text-center text-gray-400 py-8">{error}</p>}
        {loading && <p className="text-center text-gray-400 py-8">กำลังโหลด...</p>}
        {!loading &&
          posts.map((p) => (
            <button
              key={p.id}
              className="w-full text-left bg-white rounded-2xl border border-gray-100 overflow-hidden"
              onClick={() => nav(`/community/${p.id}`)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-line-light text-line-dark flex items-center justify-center text-sm font-bold shrink-0">
                      {p.authorName.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {p.authorName}
                        {p.authorRole !== 'TENANT' && (
                          <span className="ml-1 text-[10px] text-line font-semibold">เจ้าของ</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {p.roomNumber ? `ห้อง ${p.roomNumber}` : p.propertyName || typeLabel[p.type]} · {thaiDateTime(p.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.pinned && <Badge kind="info">ปักหมุด</Badge>}
                    {p.sold && <Badge kind="gray">ขายแล้ว</Badge>}
                  </div>
                </div>
                {p.title && <div className="mt-3 font-semibold">{p.title}</div>}
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{p.body}</p>
                {p.type === 'MARKETPLACE' && p.price != null && (
                  <div className={`mt-2 font-bold ${p.sold ? 'text-gray-400 line-through' : 'text-line'}`}>{baht(p.price)}</div>
                )}
              </div>
              {p.photoUrls[0] && (
                <AuthImage path={`/community/posts/${p.id}/photos/0`} className="w-full h-48 object-cover bg-gray-100" />
              )}
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">
                ความเห็น {p.commentCount}
              </div>
            </button>
          ))}
        {!loading && !error && posts.length === 0 && (
          <p className="text-center text-gray-400 py-12">ยังไม่มีโพสต์ในหมวดนี้</p>
        )}
      </div>
      <BottomNav role={navRole} />
    </div>
  )
}
