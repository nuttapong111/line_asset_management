import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { bahtExact, cls, thaiMonth } from '../../lib/utils'

interface Unit {
  id: string
  roomNumber: string
  electricRate: string
  waterRate: string
  tenants?: { name: string }[]
}

export default function MeterRecording() {
  const { id } = useParams()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const [propertyName, setPropertyName] = useState('')
  const [units, setUnits] = useState<Unit[]>([])
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [unitId, setUnitId] = useState('')
  const [prevElec, setPrevElec] = useState('0')
  const [currElec, setCurrElec] = useState('')
  const [prevWater, setPrevWater] = useState('0')
  const [currWater, setCurrWater] = useState('')
  const [status, setStatus] = useState<string>()
  const [warnings, setWarnings] = useState<{ field: string; level: string; message: string }[]>([])

  useEffect(() => {
    api.get(`/properties/${id}`).then((r) => setPropertyName(r.data.name)).catch(() => {})
    api.get(`/properties/${id}/units`).then(async (r) => {
      const list: Unit[] = r.data
      setUnits(list)
      if (list[0]) setUnitId(list[0].id)
      const flags: Record<string, boolean> = {}
      await Promise.all(
        list.map(async (u) => {
          try {
            const { data } = await api.get(`/meters/${u.id}/latest`)
            flags[u.id] = Boolean(data && data.month === month && data.year === year)
          } catch {
            flags[u.id] = false
          }
        })
      )
      setDone(flags)
    })
  }, [id, month, year])

  useEffect(() => {
    if (!unitId) return
    api.get(`/meters/${unitId}/latest`).then((r) => {
      if (r.data) {
        setPrevElec(String(Number(r.data.currElec)))
        setPrevWater(String(Number(r.data.currWater)))
        if (r.data.month === month && r.data.year === year) {
          setCurrElec(String(Number(r.data.currElec)))
          setCurrWater(String(Number(r.data.currWater)))
          setPrevElec(String(Number(r.data.prevElec)))
          setPrevWater(String(Number(r.data.prevWater)))
        } else {
          setCurrElec('')
          setCurrWater('')
        }
      } else {
        setPrevElec('0')
        setPrevWater('0')
        setCurrElec('')
        setCurrWater('')
      }
    })
  }, [unitId, month, year])

  useEffect(() => {
    if (!unitId || !currElec || !currWater) {
      setWarnings([])
      return
    }
    const t = setTimeout(() => {
      api
        .get(`/meters/${unitId}/anomaly`, {
          params: {
            prevElec: Number(prevElec),
            currElec: Number(currElec),
            prevWater: Number(prevWater),
            currWater: Number(currWater),
          },
        })
        .then((r) => setWarnings(r.data.warnings || []))
        .catch(() => setWarnings([]))
    }, 300)
    return () => clearTimeout(t)
  }, [unitId, prevElec, currElec, prevWater, currWater])

  const unit = units.find((u) => u.id === unitId)
  const idx = units.findIndex((u) => u.id === unitId)
  const next = units[idx + 1]
  const usedElec = Math.max(0, Number(currElec || 0) - Number(prevElec))
  const usedWater = Math.max(0, Number(currWater || 0) - Number(prevWater))
  const elecCost = usedElec * Number(unit?.electricRate || 5)
  const waterCost = usedWater * Number(unit?.waterRate || 18)
  const recorded = Object.values(done).filter(Boolean).length
  const waterWarn = warnings.some((w) => w.field === 'water')
  const elecWarn = warnings.some((w) => w.field === 'elec' && w.level !== 'danger')

  async function save() {
    if (!currElec || !currWater) {
      setStatus('กรุณากรอกเลขมิเตอร์ปัจจุบัน')
      return
    }
    try {
      await api.post('/meters', {
        unitId,
        month,
        year,
        prevElec: Number(prevElec),
        currElec: Number(currElec),
        prevWater: Number(prevWater),
        currWater: Number(currWater),
      })
      setDone((d) => ({ ...d, [unitId]: true }))
      setStatus('บันทึกมิเตอร์แล้ว')
      if (next) {
        setUnitId(next.id)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setStatus(typeof msg === 'string' ? msg : 'บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-white border-b border-line-soft">
        <TopBar title={`จดมิเตอร์ ${thaiMonth(month)} ${year + 543}`} sub={`${propertyName || 'อาคาร'} · จดแล้ว ${recorded}/${units.length || 0}`} />
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto no-scrollbar">
          {units.map((u) => {
            const current = u.id === unitId
            const saved = done[u.id]
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => setUnitId(u.id)}
                className={cls(
                  'h-[34px] px-2.5 rounded-[10px] text-[13px] font-bold shrink-0 border',
                  current
                    ? 'bg-primary text-white border-primary border-2'
                    : saved
                      ? 'bg-ok-bg text-ok-fg border-ok-fg'
                      : 'bg-white text-muted border-line-soft'
                )}
              >
                {saved && !current ? '✓ ' : ''}{u.roomNumber}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-3.5 flex flex-col gap-3">
        <div className="flex justify-between items-baseline">
          <strong className="font-display text-2xl">ห้อง {unit?.roomNumber || '-'}</strong>
          <span className="text-[13px] text-muted">{unit?.tenants?.[0]?.name || 'ไม่มีผู้เช่า'}</span>
        </div>
        {status && <p className="text-sm text-muted">{status}</p>}

        <MeterCard
          title="ไฟฟ้า"
          rate={`฿${Number(unit?.electricRate || 5)} / หน่วย`}
          prev={prevElec}
          curr={currElec}
          onCurr={setCurrElec}
          used={currElec ? usedElec : 0}
          cost={currElec ? elecCost : 0}
          warn={elecWarn}
        />
        <MeterCard
          title="น้ำประปา"
          rate={`฿${Number(unit?.waterRate || 18)} / หน่วย`}
          prev={prevWater}
          curr={currWater}
          onCurr={setCurrWater}
          used={currWater ? usedWater : 0}
          cost={currWater ? waterCost : 0}
          warn={waterWarn}
        />
        {warnings.map((w) => (
          <div key={w.message} className={cls('rounded-[10px] px-3 py-2 flex gap-2 items-center text-[13px]', w.level === 'danger' ? 'bg-danger-bg text-danger' : 'bg-warn-bg text-warn-fg')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 3 2 20h20z" strokeLinejoin="round" />
              <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
            </svg>
            <span>{w.message}</span>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 flex flex-col gap-1.5">
        <button type="button" className="h-[52px] rounded-cta bg-primary text-white text-[17px] font-bold" onClick={save}>
          {next ? `บันทึก แล้วไป ${next.roomNumber}` : 'บันทึกมิเตอร์'}
        </button>
        <span className="text-center text-xs text-muted">
          ยอดบิลน้ำไฟห้องนี้ {bahtExact((currElec ? elecCost : 0) + (currWater ? waterCost : 0))} · ส่งทั้งตึกได้เมื่อจดครบ
        </span>
      </div>
    </div>
  )
}

function MeterCard({
  title, rate, prev, curr, onCurr, used, cost, warn,
}: {
  title: string
  rate: string
  prev: string
  curr: string
  onCurr: (v: string) => void
  used: number
  cost: number
  warn?: boolean
}) {
  return (
    <section className="bg-white rounded-[18px] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <strong className="text-base">{title}</strong>
        <span className="ml-auto text-[13px] text-muted">{rate}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-muted">ครั้งก่อน</span>
          <span className="h-12 rounded-input bg-surface-2 flex items-center px-3.5 font-display text-lg font-semibold text-muted">{prev}</span>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          ครั้งนี้
          <input
            inputMode="decimal"
            value={curr}
            onChange={(e) => onCurr(e.target.value)}
            className={cls(
              'h-12 box-border rounded-input px-3.5 font-display text-lg font-semibold text-ink',
              warn ? 'border-2 border-warn-fg' : 'border-2 border-primary outline outline-[3px] outline-primary-soft'
            )}
          />
        </label>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">ใช้ไป {used} หน่วย</span>
        <strong>{bahtExact(cost)}</strong>
      </div>
    </section>
  )
}
