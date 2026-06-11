import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, cls } from '../../lib/utils'

export default function PaymentSelect() {
  const { invoiceId } = useParams()
  const nav = useNavigate()
  const [total, setTotal] = useState<string>('0')
  const [method, setMethod] = useState<'promptpay' | 'linepay'>('promptpay')

  useEffect(() => {
    api.get(`/invoices/${invoiceId}`).then((r) => setTotal(r.data.total))
  }, [invoiceId])

  return (
    <div>
      <TopBar title="เลือกวิธีชำระเงิน" />
      <div className="p-4 space-y-4">
        <Card className="text-center">
          <p className="text-sm text-gray-500">ยอดที่ต้องชำระ</p>
          <div className="text-3xl font-bold text-line">{baht(total)}</div>
        </Card>

        <button onClick={() => setMethod('promptpay')} className="w-full text-left">
          <Card className={cls(method === 'promptpay' && 'border-line border-2')}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">พร้อมเพย์ (PromptPay)</div>
                <div className="text-xs text-gray-400">สแกน QR แล้วแนบสลิป</div>
              </div>
              <div className={cls('w-5 h-5 rounded-full border-2', method === 'promptpay' ? 'border-line bg-line' : 'border-gray-300')} />
            </div>
          </Card>
        </button>

        <Card className="opacity-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">LINE Pay</div>
              <div className="text-xs text-gray-400">เร็ว ๆ นี้</div>
            </div>
          </div>
        </Card>

        <Button onClick={() => nav(`/payment/${invoiceId}/qr`)}>แสดง QR Code</Button>
      </div>
    </div>
  )
}
