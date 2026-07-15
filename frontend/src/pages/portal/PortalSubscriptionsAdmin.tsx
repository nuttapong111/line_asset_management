import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { baht, thaiDate, thaiDateTime } from '../../lib/utils'
import { Button } from '../../components/ui'

interface SubPayment {
  id: string
  billNo: string
  amount: number
  periodDays: number
  status: string
  slipUploadedAt?: string
  rejectReason?: string
  extendsTo?: string
  createdAt: string
  owner: { id: string; name: string; subscriptionStatus: string; expiresAt?: string }
}

export default function PortalSubscriptionsAdmin() {
  const [items, setItems] = useState<SubPayment[]>([])
  const [error, setError] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [slipUrl, setSlipUrl] = useState<string>()

  function load() {
    api
      .get('/subscriptions')
      .then((r) => setItems(r.data))
      .catch(() => setError('โหลดรายการไม่สำเร็จ'))
  }

  useEffect(() => {
    load()
  }, [])

  async function viewSlip(id: string) {
    const res = await api.get(`/subscriptions/${id}/slip`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    setSlipUrl(url)
  }

  async function approve(id: string) {
    setBusyId(id)
    try {
      await api.post(`/subscriptions/${id}/approve`)
      load()
    } catch (e: any) {
      alert(e.response?.data?.error || 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusyId(undefined)
    }
  }

  async function reject(id: string) {
    const reason = prompt('เหตุผลที่ปฏิเสธ', 'สลิปไม่ถูกต้อง') || undefined
    setBusyId(id)
    try {
      await api.post(`/subscriptions/${id}/reject`, { reason })
      load()
    } catch (e: any) {
      alert(e.response?.data?.error || 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusyId(undefined)
    }
  }

  const pending = items.filter((i) => i.status === 'UNDER_REVIEW')
  const others = items.filter((i) => i.status !== 'UNDER_REVIEW')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">บิลค่าบริการ (Owner)</h1>
        <p className="text-sm text-gray-500 mt-1">อนุมัติสลิปเพื่อต่ออายุบัญชีเจ้าของ</p>
      </div>
      {error && <p className="text-danger">{error}</p>}

      <section className="space-y-3">
        <h2 className="font-semibold">รอตรวจ ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-gray-400">ไม่มีรายการรอตรวจ</p>}
        {pending.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <div>
                <div className="font-semibold">{p.owner.name}</div>
                <div className="text-xs text-gray-400">
                  {p.billNo} · {thaiDateTime(p.slipUploadedAt)}
                </div>
              </div>
              <div className="text-line font-bold">{baht(p.amount)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="!w-auto text-sm py-1.5 px-3" onClick={() => viewSlip(p.id)}>
                ดูสลิป
              </Button>
              <Button
                className="!w-auto text-sm py-1.5 px-3"
                disabled={busyId === p.id}
                onClick={() => approve(p.id)}
              >
                อนุมัติ
              </Button>
              <Button
                variant="danger"
                className="!w-auto text-sm py-1.5 px-3"
                disabled={busyId === p.id}
                onClick={() => reject(p.id)}
              >
                ปฏิเสธ
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">รายการล่าสุด</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="p-3">เจ้าของ</th>
                <th className="p-3">บิล</th>
                <th className="p-3">ยอด</th>
                <th className="p-3">สถานะ</th>
                <th className="p-3">วัน</th>
              </tr>
            </thead>
            <tbody>
              {others.slice(0, 20).map((p) => (
                <tr key={p.id} className="border-b border-gray-50">
                  <td className="p-3">{p.owner.name}</td>
                  <td className="p-3">{p.billNo}</td>
                  <td className="p-3">{baht(p.amount)}</td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3">{thaiDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {slipUrl && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => {
            URL.revokeObjectURL(slipUrl)
            setSlipUrl(undefined)
          }}
        >
          <img src={slipUrl} alt="slip" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
