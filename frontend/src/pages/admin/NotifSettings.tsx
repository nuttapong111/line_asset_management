import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { Card, Button, Toggle, Chip } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'

interface Settings {
  invoiceEnabled: boolean
  invoiceSendDay: number
  invoiceSendTime: string
  rentReminderEnabled: boolean
  rentReminderDays: number[]
  rentReminderTime: string
  overdueEnabled: boolean
  overdueRepeatDays: number
  overdueSendTime: string
  contractEnabled: boolean
  contractReminderDays: number[]
  contractSendTime: string
  notifyTenant: boolean
  maintEnabled: boolean
  maintUnackHours: number
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
}

const TIMES = ['06:00', '08:00', '09:00', '10:00', '12:00', '18:00']

export default function NotifSettings() {
  const [s, setS] = useState<Settings>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/notifications/settings').then((r) => setS(r.data))
  }, [])

  if (!s) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>
  const upd = (patch: Partial<Settings>) => setS({ ...s, ...patch })

  const toggleDay = (key: 'rentReminderDays' | 'contractReminderDays', day: number) => {
    const arr = s[key]
    upd({ [key]: arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day].sort((a, b) => b - a) } as Partial<Settings>)
  }

  async function save() {
    await api.put('/notifications/settings', s)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="pb-6">
      <TopBar title="ตั้งค่าการแจ้งเตือน" />
      <div className="p-4 space-y-4">
        <Section title="ใบแจ้งหนี้" enabled={s.invoiceEnabled} onToggle={(v) => upd({ invoiceEnabled: v })}>
          <Label>วันที่ส่ง</Label>
          <div className="flex gap-2 flex-wrap">
            {[1, 5, 10, 15, 25].map((d) => (
              <Chip key={d} active={s.invoiceSendDay === d} onClick={() => upd({ invoiceSendDay: d })}>วันที่ {d}</Chip>
            ))}
          </div>
          <Label>เวลาส่ง</Label>
          <TimeGrid value={s.invoiceSendTime} onChange={(v) => upd({ invoiceSendTime: v })} />
        </Section>

        <Section title="เตือนล่วงหน้าค่าเช่า" enabled={s.rentReminderEnabled} onToggle={(v) => upd({ rentReminderEnabled: v })}>
          <Label>เตือนกี่วันก่อนครบกำหนด</Label>
          <div className="flex gap-2 flex-wrap">
            {[7, 3, 1].map((d) => (
              <Chip key={d} active={s.rentReminderDays.includes(d)} onClick={() => toggleDay('rentReminderDays', d)}>{d} วัน</Chip>
            ))}
          </div>
          <Label>เวลาส่ง</Label>
          <TimeGrid value={s.rentReminderTime} onChange={(v) => upd({ rentReminderTime: v })} />
        </Section>

        <Section title="ค้างชำระ" enabled={s.overdueEnabled} onToggle={(v) => upd({ overdueEnabled: v })}>
          <Label>เตือนซ้ำทุกกี่วัน</Label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 5, 7].map((d) => (
              <Chip key={d} active={s.overdueRepeatDays === d} onClick={() => upd({ overdueRepeatDays: d })}>{d} วัน</Chip>
            ))}
          </div>
          <Label>เวลาส่ง</Label>
          <TimeGrid value={s.overdueSendTime} onChange={(v) => upd({ overdueSendTime: v })} />
        </Section>

        <Section title="สัญญาใกล้หมด" enabled={s.contractEnabled} onToggle={(v) => upd({ contractEnabled: v })}>
          <Label>เตือนกี่วันก่อนหมดสัญญา</Label>
          <div className="flex gap-2 flex-wrap">
            {[60, 30, 14, 7, 3].map((d) => (
              <Chip key={d} active={s.contractReminderDays.includes(d)} onClick={() => toggleDay('contractReminderDays', d)}>{d} วัน</Chip>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-gray-600">แจ้งผู้เช่าด้วย</span>
            <Toggle checked={s.notifyTenant} onChange={(v) => upd({ notifyTenant: v })} />
          </div>
        </Section>

        <Section title="แจ้งซ่อมไม่มีคนรับ" enabled={s.maintEnabled} onToggle={(v) => upd({ maintEnabled: v })}>
          <Label>เตือนหลังจาก (ชั่วโมง)</Label>
          <div className="flex gap-2 flex-wrap">
            {[1, 3, 6, 24].map((h) => (
              <Chip key={h} active={s.maintUnackHours === h} onClick={() => upd({ maintUnackHours: h })}>{h} ชม.</Chip>
            ))}
          </div>
        </Section>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">ช่วงเวลางดแจ้งเตือน</h3>
            <Toggle checked={s.quietEnabled} onChange={(v) => upd({ quietEnabled: v })} />
          </div>
          {s.quietEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เริ่ม</Label>
                <input type="time" value={s.quietStart} onChange={(e) => upd({ quietStart: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2" />
              </div>
              <div>
                <Label>ถึง</Label>
                <input type="time" value={s.quietEnd} onChange={(e) => upd({ quietEnd: e.target.value })} className="w-full border border-gray-300 rounded-xl px-3 py-2" />
              </div>
            </div>
          )}
        </Card>

        <Button onClick={save}>{saved ? 'บันทึกแล้ว ✓' : 'บันทึก'}</Button>
      </div>
    </div>
  )
}

function Section({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && <div className="mt-3 space-y-2">{children}</div>}
    </Card>
  )
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 mt-2">{children}</p>
}
function TimeGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TIMES.map((t) => (
        <Chip key={t} active={value === t} onClick={() => onChange(t)}>{t}</Chip>
      ))}
    </div>
  )
}
