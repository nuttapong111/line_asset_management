import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Card, Badge } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiDateTime, thaiMonth } from '../../lib/utils'

const PAY_BADGE: Record<string, { kind: any; label: string }> = {
  WAITING_SLIP: { kind: 'gray', label: 'รอสลิป' },
  UNDER_REVIEW: { kind: 'pending', label: 'รอตรวจสอบ' },
  APPROVED: { kind: 'paid', label: 'ชำระแล้ว' },
  REJECTED: { kind: 'overdue', label: 'ปฏิเสธ' },
}

export default function OwnerPaymentDetail() {
  const { id } = useParams()
  const [p, setP] = useState<any>()

  useEffect(() => {
    api.get(`/owner/payments/${id}`).then((r) => setP(r.data)).catch(() => {})
  }, [id])

  if (!p) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const b = PAY_BADGE[p.status] || { kind: 'gray', label: p.status }
  const inv = p.invoice

  return (
    <div>
      <TopBar title="รายละเอียดการชำระเงิน" />
      <div className="p-4 space-y-4">
        <Card>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold">{inv.unit.property?.name}</h3>
              <p className="text-sm text-gray-400">ห้อง {inv.unit.roomNumber} · {p.tenant.name}</p>
            </div>
            <Badge kind={b.kind}>{b.label}</Badge>
          </div>
          <div className="text-sm text-gray-500">บิลเดือน {thaiMonth(inv.month)} {inv.year + 543}</div>
        </Card>

        <Card>
          <div className="flex justify-between py-1"><span className="text-gray-500">ยอดรวม</span><span className="font-semibold">{baht(inv.total)}</span></div>
          {p.receiptNo && <div className="flex justify-between py-1"><span className="text-gray-500">เลขใบเสร็จ</span><span>{p.receiptNo}</span></div>}
          {p.slipUploadedAt && <div className="flex justify-between py-1"><span className="text-gray-500">ส่งสลิป</span><span>{thaiDateTime(p.slipUploadedAt)}</span></div>}
          {p.approvedAt && <div className="flex justify-between py-1"><span className="text-gray-500">อนุมัติ</span><span>{thaiDateTime(p.approvedAt)}</span></div>}
          {p.rejectReason && <div className="flex justify-between py-1"><span className="text-gray-500">เหตุผลปฏิเสธ</span><span className="text-red-500">{p.rejectReason}</span></div>}
        </Card>

        {p.slipUrl && (
          <Card>
            <h4 className="font-semibold mb-2 text-sm">สลิปการโอน</h4>
            <img src={p.slipUrl} alt="slip" className="w-full rounded-xl border border-gray-100" />
          </Card>
        )}
      </div>
    </div>
  )
}
