import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { bahtExact, cls, thaiDate, thaiMonth } from '../../lib/utils'

type BillType = 'RENT' | 'UTILITY'

interface Property { id: string; name: string }
interface Unit { id: string; roomNumber: string; status: string; tenants: { name: string; linkedAt?: string | null }[] }
interface Draft {
  total: number
  error?: string
  rentAmount?: number
  commonFee?: number
  electricAmount?: number
  waterAmount?: number
  extraItems?: { label: string; amount: number }[]
  dueDate?: string
  meterReading?: { usedElec: number; usedWater: number }
}

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] text-ink bg-white'

export default function InvoiceBuilder() {
  const now = new Date()
  const [billType, setBillType] = useState<BillType>('RENT')
  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState('')
  const [previews, setPreviews] = useState<Record<string, Draft>>({})
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)
  const [sending, setSending] = useState(false)
  const [lineOn, setLineOn] = useState(true)

  useEffect(() => {
    api.get('/properties').then((r) => {
      setProperties(r.data)
      if (r.data[0]) setPropertyId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!propertyId) return
    api.get(`/properties/${propertyId}/units`).then(async (r) => {
      const occupied: Unit[] = r.data.filter((u: Unit) => u.status === 'OCCUPIED')
      setUnits(occupied)
      setUnitId((cur) => (occupied.some((u) => u.id === cur) ? cur : occupied[0]?.id || ''))
      const map: Record<string, Draft> = {}
      for (const u of occupied) {
        try {
          const { data } = await api.post('/invoices/build-preview', { unitId: u.id, month, year, type: billType })
          map[u.id] = data
        } catch (e: unknown) {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
          map[u.id] = { total: 0, error: msg || (billType === 'RENT' ? 'ไม่มีสัญญา' : 'ยังไม่มีมิเตอร์') }
        }
      }
      setPreviews(map)
    })
  }, [propertyId, month, year, billType])

  const unit = units.find((u) => u.id === unitId)
  const draft = unitId ? previews[unitId] : undefined
  const property = properties.find((p) => p.id === propertyId)
  const lines = draftLines(draft, billType)
  const grand = Object.values(previews).reduce((a, p) => a + (p.total || 0), 0)

  async function sendAll() {
    if (!lineOn) return
    setSending(true)
    setResult(null)
    try {
      const { data } = await api.post('/invoices/send-all', { propertyId, month, year, type: billType })
      setResult(data)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="pb-28">
      <TopBar
        title={unit ? `บิล ${unit.roomNumber}` : 'สร้างและส่งบิล'}
        sub={[unit?.tenants[0]?.name, property?.name].filter(Boolean).join(' · ')}
      />
      <div className="p-4 flex flex-col gap-3.5">
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-button bg-segment">
          {(['RENT', 'UTILITY'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={billType === t}
              className={cls(
                'h-[38px] rounded-[9px] text-sm',
                billType === t ? 'bg-white font-bold text-ink' : 'bg-transparent font-semibold text-muted'
              )}
              onClick={() => setBillType(t)}
            >
              {t === 'RENT' ? `ค่าเช่า ${thaiMonth(month)}` : `ค่าน้ำไฟ ${thaiMonth(month)}`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select aria-label="อาคาร" className={fieldCls} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="เดือน" className={fieldCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{thaiMonth(m)} {year + 543}</option>
            ))}
          </select>
        </div>

        {units.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {units.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={u.id === unitId}
                className={cls(
                  'h-[34px] px-2.5 rounded-[10px] text-[13px] font-bold shrink-0 border',
                  u.id === unitId ? 'bg-primary text-white border-primary' : 'bg-white text-muted border-line-soft'
                )}
                onClick={() => setUnitId(u.id)}
              >
                {u.roomNumber}
              </button>
            ))}
          </div>
        )}

        <section className="bg-white rounded-[18px] p-4 flex flex-col gap-2.5">
          <div className="flex justify-between items-center">
            <strong className="text-[15px]">รายการ</strong>
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-bg text-ink-2 text-xs font-bold">
              {draft?.error ? 'ส่งไม่ได้' : 'ร่าง'}
            </span>
          </div>
          {draft?.error && <p className="text-sm text-warn-fg">{draft.error}</p>}
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between text-sm">
              <span>{l.label}</span>
              <span>{l.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ))}
          {lines.length === 0 && !draft?.error && <p className="text-sm text-muted">กำลังเตรียมรายการ</p>}
          <div className="border-t border-ink pt-2.5 flex justify-between items-baseline">
            <strong className="text-[15px]">ยอดรวม</strong>
            <strong className="pf-amount text-[26px]">{bahtExact(draft?.total || 0)}</strong>
          </div>
          {draft?.dueDate && <span className="text-[13px] text-muted">ครบกำหนด {thaiDate(draft.dueDate)}</span>}
          <p className="text-[13px] text-muted">ทั้งอาคาร {units.length} ห้อง · รวม {bahtExact(grand)}</p>
        </section>

        <section className="bg-white rounded-[18px] px-4 py-3.5 flex flex-col gap-2.5">
          <strong className="text-sm">ช่องทางส่ง</strong>
          <label className="flex justify-between items-center text-sm">
            LINE Flex Message {unit?.tenants[0]?.linkedAt ? '(ผูกแล้ว)' : '(ยังไม่ผูก LINE)'}
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={lineOn} onChange={(e) => setLineOn(e.target.checked)} />
          </label>
        </section>

        {result && (
          <p className="text-sm text-center text-ok-fg bg-ok-bg rounded-card py-2">
            ส่งสำเร็จ {result.sent} ห้อง / ล้มเหลว {result.failed} ห้อง
          </p>
        )}
        {units.length === 0 && <p className="text-sm text-muted text-center">ไม่มีห้องที่มีผู้เช่า</p>}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-[1fr_1.6fr] gap-2.5">
        <button type="button" className="h-[52px] rounded-cta border-[1.5px] border-line-soft text-ink text-[15px] font-semibold" onClick={() => document.getElementById('bill-preview')?.scrollIntoView({ behavior: 'smooth' })}>
          ดูตัวอย่าง
        </button>
        <button type="button" className="h-[52px] rounded-cta bg-primary text-white text-base font-bold disabled:opacity-50" onClick={sendAll} disabled={sending || !lineOn || units.length === 0 || grand === 0}>
          {sending ? 'กำลังส่ง...' : 'ส่งบิลทาง LINE'}
        </button>
      </div>
      <div id="bill-preview" />
    </div>
  )
}

function draftLines(draft: Draft | undefined, type: BillType) {
  if (!draft || draft.error) return []
  const rows: { label: string; amount: number }[] = []
  if (type === 'RENT') {
    if (draft.rentAmount) rows.push({ label: 'ค่าเช่า', amount: draft.rentAmount })
    if (draft.commonFee) rows.push({ label: 'ค่าส่วนกลาง', amount: draft.commonFee })
    for (const item of draft.extraItems || []) rows.push(item)
  } else {
    const m = draft.meterReading
    if (draft.electricAmount) rows.push({ label: m ? `ค่าไฟ ${m.usedElec} หน่วย` : 'ค่าไฟ', amount: draft.electricAmount })
    if (draft.waterAmount) rows.push({ label: m ? `ค่าน้ำ ${m.usedWater} หน่วย` : 'ค่าน้ำ', amount: draft.waterAmount })
  }
  return rows
}
