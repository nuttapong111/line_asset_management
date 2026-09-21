import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { Badge, Button } from '../../components/ui'
import { baht, thaiDateTime } from '../../lib/utils'
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

export default function CommunityDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const role = useAuthStore((s) => s.role)
  const canModerate = role === 'ADMIN' || role === 'OWNER'
  const [post, setPost] = useState<PostDetail>()
  const [message, setMessage] = useState('')
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

  if (!post) return <div className="p-8 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div className="pb-24">
      <TopBar title={post.title || 'โพสต์'} />
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-line-light text-line-dark flex items-center justify-center font-bold">
            {post.authorName.slice(0, 1)}
          </div>
          <div>
            <div className="font-medium">
              {post.authorName}
              {post.authorRole !== 'TENANT' && <span className="ml-1 text-xs text-line">เจ้าของ</span>}
            </div>
            <div className="text-xs text-gray-400">
              {post.roomNumber ? `ห้อง ${post.roomNumber}` : post.propertyName} · {thaiDateTime(post.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {post.pinned && <Badge kind="info">ปักหมุด</Badge>}
          {post.sold && <Badge kind="gray">ขายแล้ว</Badge>}
        </div>
        {post.title && <h2 className="font-semibold text-lg">{post.title}</h2>}
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>
        {post.type === 'MARKETPLACE' && post.price != null && (
          <div className={`font-bold text-lg ${post.sold ? 'text-gray-400 line-through' : 'text-line'}`}>{baht(post.price)}</div>
        )}
        {post.photoUrls.map((_, i) => (
          <AuthImage key={i} path={`/community/posts/${post.id}/photos/${i}`} className="w-full rounded-xl bg-gray-100 min-h-[180px]" />
        ))}

        {canModerate && (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={pin}>
              {post.pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
            </Button>
            {post.type === 'MARKETPLACE' && (
              <Button variant="secondary" className="flex-1" onClick={sold}>
                {post.sold ? 'ยังขายอยู่' : 'ขายแล้ว'}
              </Button>
            )}
            <Button variant="ghost" className="flex-1 text-red-500" onClick={hide}>
              ซ่อน
            </Button>
          </div>
        )}
        {post.type === 'MARKETPLACE' && !canModerate && !post.sold && (
          <Button variant="secondary" className="w-full" onClick={sold}>
            ทำเครื่องหมายขายแล้ว
          </Button>
        )}

        <div className="border-t pt-4">
          <h3 className="font-medium mb-3">ความเห็น ({post.comments.length})</h3>
          <div className="space-y-3">
            {post.comments.map((c) => (
              <div key={c.id} className="text-sm">
                <span className="font-medium">{c.authorName}</span>
                {c.authorRole !== 'TENANT' && <span className="ml-1 text-[10px] text-line">เจ้าของ</span>}
                <span className="text-gray-400 text-xs ml-2">{thaiDateTime(c.createdAt)}</span>
                <p className="text-gray-700 mt-0.5">{c.message}</p>
              </div>
            ))}
            {post.comments.length === 0 && <p className="text-gray-400 text-sm">ยังไม่มีความเห็น</p>}
          </div>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm"
          placeholder="เขียนความเห็น..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button onClick={send}>ส่ง</Button>
      </div>
    </div>
  )
}
