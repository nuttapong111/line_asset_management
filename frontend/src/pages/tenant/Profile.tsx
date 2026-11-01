import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { closeLiff } from '../../lib/liff'
import { useAuth } from '../../hooks/useAuth'
import { thaiDate } from '../../lib/utils'

interface RoomInfo {
  property?: string
  room?: string
  floor?: number | null
  tenant?: string
  phone?: string
  linkedAt?: string | null
  emergencyPhone?: string | null
  ownerName?: string
  ownerPhone?: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const [info, setInfo] = useState<RoomInfo>({})

  useEffect(() => {
    api
      .get('/contracts/me')
      .then((r) => {
        const c = r.data
        setInfo((prev) => ({
          ...prev,
          property: c.unit?.property?.name,
          room: c.unit?.roomNumber,
          floor: c.unit?.floor,
          tenant: c.tenant?.name,
          phone: c.tenant?.phone,
          linkedAt: c.tenant?.linkedAt,
          emergencyPhone: c.unit?.property?.emergencyPhone,
          ownerName: c.unit?.property?.owner?.name || c.unit?.property?.admin?.name,
          ownerPhone: c.unit?.property?.owner?.phone || c.unit?.property?.admin?.phone,
        }))
      })
      .catch(() => {})
    api
      .get('/community/meta')
      .then((r) =>
        setInfo((prev) => ({
          ...prev,
          ownerName: prev.ownerName || r.data?.ownerName,
          property: prev.property || r.data?.properties?.[0]?.name,
        }))
      )
      .catch(() => {})
  }, [])

  const owner = info.ownerName || 'เจ้าของ'
  const call = info.ownerPhone || info.emergencyPhone

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar title="ติดต่อ" />
      <div className="px-4 pt-4 flex flex-col gap-3.5 pb-8">
        <section className="bg-white rounded-hero p-5 flex flex-col items-center gap-2.5 text-center">
          <span className="w-[72px] h-[72px] rounded-full bg-primary-soft text-primary font-display text-[28px] font-bold flex items-center justify-center">
            {owner.slice(0, 1)}
          </span>
          <div className="flex flex-col gap-0.5">
            <strong className="font-display text-xl">{owner}</strong>
            <span className="text-sm text-muted">เจ้าของ{info.property ? ` · ${info.property}` : ''}</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-2 text-[13px] text-ink-2">ตอบกลับปกติ 08:00–20:00</span>
          <div className="w-full grid grid-cols-2 gap-2.5 mt-1.5">
            {call ? (
              <a href={`tel:${call}`} className="h-[50px] rounded-cta bg-primary text-white text-base font-bold flex items-center justify-center gap-2">
                โทร
              </a>
            ) : (
              <span className="h-[50px] rounded-cta bg-surface-2 text-muted text-base font-bold flex items-center justify-center">โทร</span>
            )}
            <button
              type="button"
              onClick={() => closeLiff()}
              className="h-[50px] rounded-cta border-[1.5px] border-primary text-primary text-base font-bold"
            >
              ส่งข้อความ
            </button>
          </div>
        </section>

        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2.5">
          <strong className="text-[15px]">ห้องของฉัน</strong>
          <Row k="ห้อง" v={[info.room, info.floor != null ? `ชั้น ${info.floor}` : ''].filter(Boolean).join(' · ') || '—'} />
          <Row k="ผู้เช่า" v={info.tenant || user?.name || '—'} />
          <Row k="เบอร์ที่ลงทะเบียน" v={info.phone || '—'} />
          <Row k="ผูก LINE เมื่อ" v={info.linkedAt ? thaiDate(info.linkedAt) : '—'} />
        </section>

        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2.5">
          <strong className="text-[15px]">เบอร์ฉุกเฉินของอาคาร</strong>
          <div className="flex justify-between text-sm gap-3">
            <span className="text-muted">นิติ / รปภ.</span>
            {info.emergencyPhone ? (
              <a href={`tel:${info.emergencyPhone}`} className="font-bold text-primary">
                {info.emergencyPhone}
              </a>
            ) : (
              <span className="text-muted">ยังไม่ระบุ</span>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )
}
