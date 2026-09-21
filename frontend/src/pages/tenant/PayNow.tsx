import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { Button } from '../../components/ui'

export default function PayNow() {
  const nav = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api
      .get('/invoices')
      .then((r) => {
        const unpaid = (r.data as { id: string; status: string }[]).find((i) =>
          ['PENDING', 'OVERDUE'].includes(i.status)
        )
        if (unpaid) nav(`/payment/${unpaid.id}`, { replace: true })
        else setReady(true)
      })
      .catch(() => setReady(true))
  }, [nav])

  if (!ready) {
    return (
      <div>
        <TopBar title="ชำระเงิน" />
        <p className="p-8 text-center text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="ชำระเงิน" />
      <div className="p-8 text-center space-y-4">
        <p className="text-gray-500">ไม่มียอดค้างชำระในขณะนี้</p>
        <Button variant="secondary" onClick={() => nav('/documents')}>
          ดูเอกสาร
        </Button>
      </div>
    </div>
  )
}
