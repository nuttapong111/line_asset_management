import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { useAuthStore } from '../../store/authStore'
import { AuthImage } from '../../components/AuthImage'
import type { CommunityPost } from './CommunityFeed'

interface Comment {
  id: string
  authorRole: string
  authorName: string
  message: string
  createdAt: string
}

interface PostDetail extends CommunityPost {
  comments: Comment[]
  hidden?: boolean
}

const TYPE_TITLE: Record<string, string> = {
  ANNOUNCEMENT: 'ประกาศ',
  DISCUSSION: 'คุยกัน',
  MARKETPLACE: 'ซื้อขาย',
}

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return m < 1 ? 'เมื่อสักครู่' : `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  return `${Math.floor(h / 24)} วันที่แล้ว`
}

export default function CommunityDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const canModerate = role === 'ADMIN' || role === 'OWNER'
  const [post, setPost] = useState<PostDetail>()
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState(0)
  const [error, setError] = useState<string>()

  function load() {
    api.get(`/community/posts/${id}`).then((r) => setPost(r.data))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function send() {
    if (!message.trim()) return
    try {
      await api.post(`/community/posts/${id}/comments`, { message })
      setMessage('')
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'ส่งความเห็นไม่สำเร็จ')
    }
  }

  async function pin() {
    await api.put(`/community/posts/${id}/pin`)
    load()
  }
  async function hide() {
    await api.put(`/community/posts/${id}/hide`)
    nav('/community', { replace: true })
  }
  async function sold() {
    try {
      await api.put(`/community/posts/${id}/sold`)
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setError(err.response?.data?.error || 'อัปเดตไม่สำเร็จ')
    }
  }

  if (!post) return <div className="p-6"><div className="h-64 bg-surface-2" /></div>

  const price = post.price != null ? '฿' + Number(post.price).toLocaleString('th-TH', { maximumFractionDigits: 0 }) : null
  const photos = post.photoUrls.length

  return (
    <div className="h-screen flex flex-col bg-canvas">
      <TopBar title={TYPE_TITLE[post.type] || 'โพสต์'} />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {photos > 0 && (
          <button
            type="button"
            className="h-[260px] bg-surface-2 relative"
            onClick={() => setPhoto((n) => (n + 1) % photos)}
            aria-label={`รูป ${photo + 1} จาก ${photos}`}
          >
            <AuthImage path={`/community/posts/${post.id}/photos/${photo}`} alt="" className="w-full h-[260px] object-cover" />
            {photos > 1 && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                {post.photoUrls.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full bg-white ${i === photo ? 'w-[18px]' : 'w-1.5 opacity-60'}`} />
                ))}
              </div>
            )}
          </button>
        )}
        <section className="bg-white p-4 flex flex-col gap-2">
          {post.type === 'MARKETPLACE' && price && (
            <div className="flex justify-between items-center">
              <strong className={`font-display text-[26px] ${post.sold ? 'text-muted line-through' : 'text-primary'}`}>{price}</strong>
              <span className={`px-2.5 py-1 rounded-full text-[13px] font-bold ${post.sold ? 'bg-neutral-bg text-neutral-fg' : 'bg-ok-bg text-ok-fg'}`}>
                {post.sold ? 'ขายแล้ว' : 'ยังขายอยู่'}
              </span>
            </div>
          )}
          {post.title && <strong className="text-lg">{post.title}</strong>}
          <span className="text-sm leading-relaxed text-ink-2 whitespace-pre-wrap">{post.body}</span>
          <div className="flex items-center gap-2.5 pt-1.5">
            <span className="w-8 h-8 rounded-full bg-info-bg text-info text-[13px] font-bold flex items-center justify-center">
              {post.authorName.slice(0, 1)}
            </span>
            <span className="text-sm">
              <strong>{post.authorName}</strong>
              {' · '}
              {post.roomNumber || (post.authorRole !== 'TENANT' ? 'เจ้าของ' : post.propertyName)}
              {' · '}
              {ago(post.createdAt)}
            </span>
          </div>
        </section>

        {canModerate && (
          <div className="px-4 pt-3 flex gap-2">
            <button type="button" onClick={pin} className="h-10 px-3 rounded-input bg-white text-sm font-semibold text-primary">
              {post.pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
            </button>
            {post.type === 'MARKETPLACE' && (
              <button type="button" onClick={sold} className="h-10 px-3 rounded-input bg-white text-sm font-semibold">
                {post.sold ? 'ยังขายอยู่' : 'ขายแล้ว'}
              </button>
            )}
            <button type="button" onClick={hide} className="h-10 px-3 rounded-input bg-white text-sm font-semibold text-danger">
              ซ่อน
            </button>
          </div>
        )}
        {post.type === 'MARKETPLACE' && !canModerate && (
          <div className="px-4 pt-3">
            <button type="button" onClick={sold} className="h-10 px-3 rounded-input bg-white text-sm font-semibold text-primary">
              {post.sold ? 'ยังขายอยู่' : 'ทำเครื่องหมายขายแล้ว'}
            </button>
          </div>
        )}

        <section className="px-4 py-3.5 flex flex-col gap-3">
          <strong className="text-[15px]">ความคิดเห็น {post.comments.length}</strong>
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <span className="w-8 h-8 rounded-full bg-surface-2 text-[13px] font-bold flex items-center justify-center shrink-0">
                {c.authorName.slice(0, 1)}
              </span>
              <div className="bg-white rounded-[4px_16px_16px_16px] px-3.5 py-2.5 flex flex-col gap-0.5">
                <span className="text-xs text-muted">
                  {c.authorName}
                  {c.authorRole !== 'TENANT' ? ' · เจ้าของ' : ''}
                </span>
                <span className="text-sm">{c.message}</span>
              </div>
            </div>
          ))}
          {post.comments.length === 0 && <p className="text-sm text-muted">ยังไม่มีความคิดเห็น</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </section>
      </div>
      <div className="bg-white border-t border-[#EEF1EF] px-3 pt-2.5 pb-6 flex gap-2 items-center">
        <input
          aria-label="ความคิดเห็น"
          placeholder="เขียนความคิดเห็น"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 min-w-0 h-11 box-border border-[1.5px] border-[#DCE3DF] rounded-full px-4 text-[15px] outline-none focus:border-primary"
        />
        <button type="button" onClick={send} className="h-11 px-[18px] rounded-full bg-primary text-white text-[15px] font-bold">
          ส่ง
        </button>
      </div>
    </div>
  )
}
