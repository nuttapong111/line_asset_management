import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { useAuth } from '../../hooks/useAuth'
import api from '../../lib/axios'

export default function Settings() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [richMsg, setRichMsg] = useState<string>()
  const [richLoading, setRichLoading] = useState(false)

  async function setupRichMenu() {
    setRichLoading(true)
    setRichMsg(undefined)
    try {
      const { data } = await api.post('/admin/richmenu/setup')
      setRichMsg(data.ok ? 'ติดตั้ง Rich Menu สำเร็จ ✓ (เปิดแชต OA เพื่อตรวจสอบ)' : data.error || 'ไม่สำเร็จ')
    } catch (e: any) {
      setRichMsg(e.response?.data?.error || 'ติดตั้งไม่สำเร็จ')
    } finally {
      setRichLoading(false)
    }
  }

  const items = [
    { label: 'การแจ้งเตือน', desc: 'ตั้งค่าใบแจ้งหนี้ เตือนค่าเช่า ฯลฯ', path: '/admin/notifications' },
    { label: 'สร้างใบแจ้งหนี้', desc: 'สร้างและส่งบิลรายเดือน', path: '/admin/invoice-builder' },
    { label: 'รายงานรายได้', desc: 'สรุปรายได้และส่งออกข้อมูล', path: '/admin/reports' },
  ]

  return (
    <div className="pb-20">
      <TopBar title="ตั้งค่า" back={false} />
      <div className="p-4 space-y-4">
        <Card className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-line-light flex items-center justify-center text-line font-bold">
            {user?.name?.[0] || 'A'}
          </div>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-xs text-gray-400">ผู้ดูแลระบบ</div>
          </div>
        </Card>

        {items.map((it) => (
          <Card key={it.path} onClick={() => nav(it.path)} className="flex items-center justify-between">
            <div>
              <div className="font-medium">{it.label}</div>
              <div className="text-xs text-gray-400">{it.desc}</div>
            </div>
            <span className="text-gray-300">›</span>
          </Card>
        ))}

        <Card>
          <div className="font-medium">Rich Menu (LINE OA)</div>
          <div className="text-xs text-gray-400 mb-3">
            ติดตั้งเมนูลัด 6 ปุ่มด้านล่างแชต LINE OA (ตั้งเป็นเมนูเริ่มต้นให้ทุกคน)
          </div>
          <Button variant="secondary" onClick={setupRichMenu} disabled={richLoading}>
            {richLoading ? 'กำลังติดตั้ง...' : 'ติดตั้ง / อัปเดต Rich Menu'}
          </Button>
          {richMsg && <p className="text-sm mt-2 text-gray-600">{richMsg}</p>}
        </Card>
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
