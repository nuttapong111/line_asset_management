import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { Button, Card, Input, Textarea } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { baht, thaiMonth } from '../../lib/utils'

interface Preview {
  deposit: number
  unpaidTotal: number
  suggestedRefund: number
  tenantName: string
  roomNumber: string
  unpaidInvoices: { id: string; type: string; month: number; year: number; total: number; status: string }[]
  lastMeter: { month: number; year: number; currElec: number; currWater: number } | null
}

export default function MoveOut() {
  const { id } = useParams()
  const nav = useNavigate()
  const [preview, setPreview] = useState<Preview>()
  const [error, setError] = useState<string>()
  const [notes, setNotes] = useState('')
  const [finalElec, setFinalElec] = useState('')
  const [finalWater, setFinalWater] = useState('')
  const [deductions, setDeductions] = useState<{ label: string; amount: string }[]>([{ label: '', amount: '' }])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .get(`/contracts/${id}/move-out-preview`)
      .then((r) => {
        setPreview(r.data)
        if (r.data.lastMeter) {
          setFinalElec(String(r.data.lastMeter.currElec))
          setFinalWater(String(r.data.lastMeter.currWater))
        }
      })
      .catch((e) => setError(e.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ'))
  }, [id])

  const extraDeduct = deductions.reduce((a, d) => a + (Number(d.amount) || 0), 0)
  const refund = preview ? preview.deposit - preview.unpaidTotal - extraDeduct : 0

  async function submit() {
    if (!confirm('ยืนยันย้ายออกและเคลียร์เงินประกัน? การกระทำนี้ยกเลิกไม่ได้')) return
    setSaving(true)
    try {
      await api.post(`/contracts/${id}/move-out`, {
        notes: notes || undefined,
        finalElec: finalElec ? Number(finalElec) : undefined,
        finalWater: finalWater ? Number(finalWater) : undefined,
        deductions: deductions
          .filter((d) => d.label.trim() && Number(d.amount) > 0)
          .map((d) => ({ label: d.label.trim(), amount: Number(d.amount) })),
      })
      nav(-1)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      alert(typeof msg === 'string' ? msg : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div>
        <TopBar title="ย้ายออก" />
        <p className="p-8 text-center text-gray-400">{error}</p>
      </div>
    )
  }
  if (!preview) return <div className="p-6 text-center text-gray-400">กำลังโหลด...</div>

  return (
    <div className="pb-8">
      <TopBar title="ย้ายออก / เคลียร์ประกัน" />
      <div className="p-4 space-y-4">
        <Card>
          <p className="font-semibold">ห้อง {preview.roomNumber} · {preview.tenantName}</p>
          <div className="grid grid-cols-2 gap-3 text-sm mt-3">
            <div>
              <div className="text-xs text-gray-400">เงินประกัน</div>
              <div className="font-medium">{baht(preview.deposit)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">บิลค้างชำระ</div>
              <div className="font-medium text-danger">{baht(preview.unpaidTotal)}</div>
            </div>
          </div>
        </Card>

        {preview.unpaidInvoices.length > 0 && (
          <Card>
            <h3 className="font-semibold mb-2">บิลที่ยังไม่ชำระ — จะหักจากประกัน</h3>
            {preview.unpaidInvoices.map((i) => (
              <div key={i.id} className="flex justify-between text-sm py-1">
                <span className="text-gray-500">
                  {i.type === 'RENT' ? 'ค่าเช่า' : 'น้ำ/ไฟ'} {thaiMonth(i.month)} {i.year}
                </span>
                <span>{baht(i.total)}</span>
              </div>
            ))}
          </Card>
        )}

        <Card className="space-y-3">
          <h3 className="font-semibold">มิเตอร์รอบสุดท้าย</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ไฟฟ้า" type="number" value={finalElec} onChange={(e) => setFinalElec(e.target.value)} />
            <Input label="น้ำ" type="number" value={finalWater} onChange={(e) => setFinalWater(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="font-semibold">หักเพิ่ม (ของเสีย / ทำความสะอาด)</h3>
          {deductions.map((d, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_90px] gap-2">
              <Input
                placeholder="เช่น ซ่อมประตู"
                value={d.label}
                onChange={(e) => {
                  const next = [...deductions]
                  next[idx] = { ...next[idx], label: e.target.value }
                  setDeductions(next)
                }}
              />
              <Input
                type="number"
                placeholder="ยอด"
                value={d.amount}
                onChange={(e) => {
                  const next = [...deductions]
                  next[idx] = { ...next[idx], amount: e.target.value }
                  setDeductions(next)
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-line"
            onClick={() => setDeductions([...deductions, { label: '', amount: '' }])}
          >
            + เพิ่มรายการหัก
          </button>
        </Card>

        <Textarea label="หมายเหตุ" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Card className={refund >= 0 ? 'border-line bg-line-light' : 'border-red-200 bg-red-50'}>
          <div className="flex justify-between items-center">
            <span className="font-semibold">{refund >= 0 ? 'คืนผู้เช่า' : 'ผู้เช่าต้องจ่ายเพิ่ม'}</span>
            <span className={`text-xl font-bold ${refund >= 0 ? 'text-line-dark' : 'text-danger'}`}>{baht(Math.abs(refund))}</span>
          </div>
        </Card>

        <Button variant="danger" onClick={submit} disabled={saving}>
          {saving ? 'กำลังดำเนินการ...' : 'ยืนยันย้ายออก'}
        </Button>
      </div>
    </div>
  )
}
