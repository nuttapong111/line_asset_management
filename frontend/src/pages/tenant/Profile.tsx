import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui'
import { BottomNav } from '../../components/layout/BottomNav'
import { TopBar } from '../../components/layout/TopBar'
import { useAuth } from '../../hooks/useAuth'

export default function Profile() {
  const nav = useNavigate()
  const { user } = useAuth()

  const items = [
    { label: 'สัญญาเช่า', path: '/contract', icon: '📄' },
    { label: 'ประวัติการชำระ', path: '/tenant/history', icon: '🧾' },
    { label: 'แจ้งซ่อม', path: '/tenant/maintenance', icon: '🔧' },
  ]

  return (
    <div className="pb-20">
      <TopBar title="โปรไฟล์" back={false} />
      <div className="p-4 space-y-4">
        <Card className="flex items-center gap-3">
          {user?.pictureUrl ? (
            <img src={user.pictureUrl} className="w-14 h-14 rounded-full" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-line-light flex items-center justify-center text-line font-bold text-xl">
              {user?.name?.[0] || 'T'}
            </div>
          )}
          <div>
            <div className="font-semibold text-lg">{user?.name}</div>
            <div className="text-xs text-gray-400">ผู้เช่า</div>
          </div>
        </Card>

        {items.map((it) => (
          <Card key={it.path} onClick={() => nav(it.path)} className="flex items-center gap-3">
            <span className="text-xl">{it.icon}</span>
            <span className="flex-1 font-medium">{it.label}</span>
            <span className="text-gray-300">›</span>
          </Card>
        ))}

        <Card className="text-center text-sm text-gray-400">
          ติดต่อผู้ดูแล: แชทผ่าน LINE OA ได้ตลอด 24 ชม.
        </Card>
      </div>
      <BottomNav role="TENANT" />
    </div>
  )
}
