import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht } from '../../lib/utils'

interface Unit {
  id: string
  roomNumber: string
  electricRate: string
  waterRate: string
}

export default function MeterRecording() {
  const { id } = useParams()
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState('')
  const [prevElec, setPrevElec] = useState('0')
  const [currElec, setCurrElec] = useState('')
  const [prevWater, setPrevWater] = useState('0')
  const [currWater, setCurrWater] = useState('')
  const [status, setStatus] = useState<string>()

  useEffect(() => {
    api.get(`/properties/${id}/units`).then((r) => {
      setUnits(r.data)
      if (r.data[0]) setUnitId(r.data[0].id)
    })
  }, [id])

  useEffect(() => {
    if (!unitId) return
    api.get(`/meters/${unitId}/latest`).then((r) => {
      if (r.data) {
        setPrevElec(String(r.data.currElec))
        setPrevWater(String(r.data.currWater))
      } else {
        setPrevElec('0')
        setPrevWater('0')
      }
    })
  }, [unitId])

  const unit = units.find((u) => u.id === unitId)
  const usedElec = Math.max(0, Number(currElec) - Number(prevElec))
  const usedWater = Math.max(0, Number(currWater) - Number(prevWater))
  const elecCost = usedElec * Number(unit?.electricRate || 5)
  const waterCost = usedWater * Number(unit?.waterRate || 18)

  async function save() {
    if (!currElec || !currWater) {
      setStatus('กรุณากรอกเลขมิเตอร์ปัจจุบัน')
      return
    }
    const now = new Date()
    try {
      await api.post('/meters', {
        unitId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        prevElec: Number(prevElec),
        currElec: Number(currElec),
        prevWater: Number(prevWater),
        currWater: Number(currWater),
      })
      setStatus('บันทึกมิเตอร์สำเร็จ ✓')
      setCurrElec('')
      setCurrWater('')
    } catch (e: any) {
      setStatus(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
    }
  }

  return (
    <div>
      <TopBar title="บันทึกมิเตอร์" />
      <div className="p-4 space-y-4">
        <Card>
          <label className="block text-sm font-medium text-gray-600 mb-1">เลือกห้อง</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-full rounded-xl border border-gray-300 px-3 py-2.5">
            {units.map((u) => (
              <option key={u.id} value={u.id}>ห้อง {u.roomNumber}</option>
            ))}
          </select>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <MeterBox
            title="⚡ ไฟฟ้า"
            prev={prevElec}
            curr={currElec}
            onCurr={setCurrElec}
            used={usedElec}
            cost={elecCost}
          />
          <MeterBox
            title="💧 น้ำ"
            prev={prevWater}
            curr={currWater}
            onCurr={setCurrWater}
            used={usedWater}
            cost={waterCost}
          />
        </div>

        {status && <p className="text-center text-sm text-gray-600">{status}</p>}
        <Button onClick={save}>บันทึกมิเตอร์</Button>
      </div>
    </div>
  )
}

function MeterBox({
  title,
  prev,
  curr,
  onCurr,
  used,
  cost,
}: {
  title: string
  prev: string
  curr: string
  onCurr: (v: string) => void
  used: number
  cost: number
}) {
  return (
    <Card>
      <h4 className="font-semibold mb-2">{title}</h4>
      <p className="text-xs text-gray-400">เลขครั้งก่อน</p>
      <p className="font-mono text-lg mb-2">{prev}</p>
      <p className="text-xs text-gray-400">เลขปัจจุบัน</p>
      <input
        type="number"
        value={curr}
        onChange={(e) => onCurr(e.target.value)}
        className="w-full font-mono text-xl border border-gray-300 rounded-lg px-2 py-1 mb-2"
      />
      <div className="bg-line-light text-line-dark rounded-lg px-2 py-1 text-xs text-center">
        ใช้ไป {used} หน่วย = {baht(cost)}
      </div>
    </Card>
  )
}
