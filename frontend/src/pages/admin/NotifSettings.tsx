import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { cls } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface Settings {
  scope?: 'OWNER' | 'ADMIN'
  invoiceEnabled: boolean
  invoiceDaysBeforeDue: number
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

export default function NotifSettings() {
  const role = useAuthStore((s) => s.role)
  const [s, setS] = useState<Settings>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/notifications/settings').then((r) => setS(r.data))
  }, [])

  if (!s) {
    return (
      <div>
        <TopBar title="การแจ้งเตือน" />
        <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-card bg-surface-2" />)}</div>
      </div>
    )
  }
  const upd = (patch: Partial<Settings>) => setS({ ...s, ...patch })
  const isOwner = role === 'OWNER' || s.scope === 'OWNER'

  const toggleDay = (key: 'rentReminderDays' | 'contractReminderDays', day: number) => {
    const arr = s[key]
    upd({ [key]: arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day].sort((a, b) => b - a) } as Partial<Settings>)
  }

  async function save() {
    if (!s) return
    const { scope: _scope, ...body } = s
    await api.put('/notifications/settings', body)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="pb-8">
      <TopBar
        title="การแจ้งเตือน"
        sub={isOwner ? 'ใช้กับทุกอาคารของคุณ' : 'ใช้กับอาคารที่ยังไม่มีเจ้าของ'}
        right={
          <button type="button" className="text-primary text-sm font-bold" onClick={save}>
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        }
      />
      <div className="px-4 py-3.5 flex flex-col gap-2.5">
        <Rule
          title="ส่งบิลค่าเช่าอัตโนมัติ"
          sub={`ก่อนวันครบกำหนด · เวลา ${s.invoiceSendTime}`}
          on={s.invoiceEnabled}
          toggle={() => upd({ invoiceEnabled: !s.invoiceEnabled })}
        >
          {[0, 1, 3, 4, 5, 7].map((d) => (
            <Chip key={d} on={s.invoiceDaysBeforeDue === d} label={d === 0 ? 'วันครบกำหนด' : `${d} วันก่อน`} onClick={() => upd({ invoiceDaysBeforeDue: d })} />
          ))}
          {['06:00', '08:00', '09:00'].map((t) => (
            <Chip key={t} on={s.invoiceSendTime === t} label={t} onClick={() => upd({ invoiceSendTime: t })} />
          ))}
        </Rule>
        <Rule title="เตือนก่อนครบกำหนด" sub="ส่งให้ผู้เช่าที่ยังไม่จ่าย" on={s.rentReminderEnabled} toggle={() => upd({ rentReminderEnabled: !s.rentReminderEnabled })}>
          {[3, 1, 5, 7].map((d) => (
            <Chip key={d} on={s.rentReminderDays.includes(d)} label={`${d} วัน`} onClick={() => toggleDay('rentReminderDays', d)} />
          ))}
        </Rule>
        <Rule title="เตือนเลยกำหนด" sub="ซ้ำจนกว่าจะชำระ" on={s.overdueEnabled} toggle={() => upd({ overdueEnabled: !s.overdueEnabled })}>
          {[1, 2, 3, 7].map((d) => (
            <Chip key={d} on={s.overdueRepeatDays === d} label={`ทุก ${d} วัน`} onClick={() => upd({ overdueRepeatDays: d })} />
          ))}
        </Rule>
        <Rule
          title="สัญญาใกล้หมด"
          sub={s.notifyTenant ? 'แจ้งคุณและผู้เช่า' : 'แจ้งคุณอย่างเดียว'}
          on={s.contractEnabled}
          toggle={() => upd({ contractEnabled: !s.contractEnabled })}
        >
          {[60, 30, 14, 7].map((d) => (
            <Chip key={d} on={s.contractReminderDays.includes(d)} label={`${d} วัน`} onClick={() => toggleDay('contractReminderDays', d)} />
          ))}
          <Chip on={s.notifyTenant} label={s.notifyTenant ? 'แจ้งผู้เช่า' : 'ไม่แจ้งผู้เช่า'} onClick={() => upd({ notifyTenant: !s.notifyTenant })} />
        </Rule>
        <Rule title="ใบงานซ่อมค้าง “ใหม่”" sub="เตือนคุณถ้ายังไม่รับเรื่อง" on={s.maintEnabled} toggle={() => upd({ maintEnabled: !s.maintEnabled })}>
          {[1, 3, 6, 24].map((h) => (
            <Chip key={h} on={s.maintUnackHours === h} label={`เกิน ${h} ชม.`} onClick={() => upd({ maintUnackHours: h })} />
          ))}
        </Rule>
        <Rule title="ช่วงเงียบ" sub="ไม่ส่งข้อความอัตโนมัติช่วงนี้" on={s.quietEnabled} toggle={() => upd({ quietEnabled: !s.quietEnabled })}>
          <span className="h-[30px] px-2.5 rounded-lg bg-ok-bg text-ok-fg border border-ok-fg text-[13px] font-semibold inline-flex items-center gap-2">
            <input type="time" aria-label="เริ่มช่วงเงียบ" className="bg-transparent" value={s.quietStart} onChange={(e) => upd({ quietStart: e.target.value })} />
            –
            <input type="time" aria-label="สิ้นสุดช่วงเงียบ" className="bg-transparent" value={s.quietEnd} onChange={(e) => upd({ quietEnd: e.target.value })} />
          </span>
        </Rule>
      </div>
    </div>
  )
}

function Rule({
  title, sub, on, toggle, children,
}: {
  title: string
  sub: string
  on: boolean
  toggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-card px-3.5 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="flex-1 flex flex-col">
          <strong className="text-[15px]">{title}</strong>
          <span className="text-xs text-muted">{sub}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={title}
          onClick={toggle}
          className={cls('relative w-12 h-7 rounded-full shrink-0', on ? 'bg-primary' : 'bg-segment')}
        >
          <span className={cls('absolute top-[3px] w-[22px] h-[22px] rounded-full bg-white transition', on ? 'left-[23px]' : 'left-[3px]')} />
        </button>
      </div>
      {on && <div className="flex flex-wrap gap-1.5">{children}</div>}
    </section>
  )
}

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cls(
        'h-[30px] px-2.5 rounded-lg text-[13px] font-semibold border',
        on ? 'bg-ok-bg text-ok-fg border-ok-fg' : 'bg-white text-muted border-dashed border-line-input'
      )}
    >
      {label}
    </button>
  )
}
