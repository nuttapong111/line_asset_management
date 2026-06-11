import { useNavigate } from 'react-router-dom'
import { Button, Card } from '../../components/ui'
import { closeLiff } from '../../lib/liff'

export default function PaymentSuccess() {
  const nav = useNavigate()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-24 h-24 rounded-full bg-line-light flex items-center justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-line flex items-center justify-center text-white text-4xl">✓</div>
      </div>
      <h1 className="text-xl font-bold mb-1">ส่งสลิปเรียบร้อย</h1>
      <p className="text-gray-500 text-sm text-center mb-6">
        ระบบได้รับสลิปของคุณแล้ว กำลังรอแอดมินตรวจสอบ คุณจะได้รับใบเสร็จผ่าน LINE เมื่ออนุมัติ
      </p>
      <div className="w-full max-w-sm space-y-3">
        <Button onClick={() => closeLiff()}>กลับ LINE Chat</Button>
        <Button variant="secondary" onClick={() => nav('/tenant/home')}>กลับหน้าหลัก</Button>
      </div>
    </div>
  )
}
