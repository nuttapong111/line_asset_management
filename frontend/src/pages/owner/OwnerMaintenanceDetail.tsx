import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { thaiDateTime } from '../../lib/utils'

const MAINT_BADGE: Record<string, { kind: any; label: string }> = {
  NEW: { kind: 'overdue', label: 'ใหม่' },
  ACKNOWLEDGED: { kind: 'info', label: 'รับเรื่อง' },
  IN_PROGRESS: { kind: 'pending', label: 'กำลังซ่อม' },
  SCHEDULED: { kind: 'info', label: 'นัดหมาย' },
  DONE: { kind: 'paid', label: 'เสร็จสิ้น' },
  CLOSED: { kind: 'gray', label: 'ปิดงาน' },
}
const CAT_LABEL: Record<string, string> = {
  ELECTRIC: 'ไฟฟ้า', PLUMBING: 'ประปา', APPLIANCE: 'เครื่องใช้ไฟฟ้า', GENERAL: 'ทั่วไป',
}

export default function OwnerMaintenanceDetail() {
  const { id } = useParams()
  const [t, setT] = useState<any>()

  useEffect(() => {
    api.get(`/owner/maintenance/${id}`).then((r) => setT(r.data)).catch(() => {})
  }, [id])

  if (!t) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const b = MAINT_BADGE[t.status] || { kind: 'gray', label: t.status }

  return (
    <div>
      <TopBar title="รายละเอียดแจ้งซ่อม" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start mb-1">
            <div>
              <h3 className="font-semibold">{t.title}</h3>
              <p className="text-sm text-gray-400">{t.ticketNo} · ห้อง {t.unit.roomNumber}</p>
            </div>
            <Badge kind={b.kind}>{b.label}</Badge>
          </div>
          <p className="text-xs text-gray-400">หมวด: {CAT_LABEL[t.category] || t.category} · {thaiDateTime(t.createdAt)}</p>
          {t.description && <p className="text-sm text-gray-600 mt-2">{t.description}</p>}
        </Card>

        {t.photoUrls?.length ? (
          <Card>
            <h4 className="font-semibold mb-2 text-sm">รูปภาพ</h4>
            <div className="grid grid-cols-2 gap-2">
              {t.photoUrls.map((u: string, i: number) => (
                <img key={i} src={u} alt={`photo-${i}`} className="w-full rounded-xl border border-gray-100" />
              ))}
            </div>
          </Card>
        ) : null}

        {t.messages?.length ? (
          <Card>
            <h4 className="font-semibold mb-2 text-sm">ความเคลื่อนไหว</h4>
            <div className="space-y-2">
              {t.messages.map((m: any) => (
                <div key={m.id} className="text-sm">
                  <span className="font-medium">{m.senderName}</span>
                  <span className="text-gray-400 text-xs ml-2">{thaiDateTime(m.createdAt)}</span>
                  <p className="text-gray-600">{m.message}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
