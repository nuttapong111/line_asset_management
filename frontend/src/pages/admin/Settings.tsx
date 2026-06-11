import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { useAuth } from '../../hooks/useAuth'

export default function Settings() {
  const nav = useNavigate()
  const { user } = useAuth()

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
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
