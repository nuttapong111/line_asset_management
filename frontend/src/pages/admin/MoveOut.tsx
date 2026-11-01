import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../lib/axios'
import { TopBar } from '../../components/layout/TopBar'
import { bahtExact, thaiMonth } from '../../lib/utils'

interface Preview {
  deposit: number
  unpaidTotal: number
  suggestedRefund: number
  tenantName: string
  roomNumber: string
  unpaidInvoices: { id: string; type: string; month: number; year: number; total: number; status: string }[]
  lastMeter: { month: number; year: number; currElec: number; currWater: number } | null
}

const fieldCls = 'h-11 box-border border-[1.5px] border-line-input rounded-input px-3 text-[15px] font-semibold text-ink bg-white'

export default function MoveOut() {
  const { id } = useParams()
  const nav = useNavigate()
  const [preview, setPreview] = useState<Preview>()
  const [error, setError] = useState<string>()
  const [moveDate, setMoveDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState<'promptpay' | 'cash'>('promptpay')
  const [finalElec, setFinalElec] = useState('')
  const [finalWater, setFinalWater] = useState('')
  const [deductions, setDeductions] = useState<{ label: string; amount: string }[]>([])
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
    if (!preview) return
    if (!confirm('ยืนยันย้ายออกและเคลียร์เงินประกัน? การกระทำนี้ยกเลิกไม่ได้')) return
    setSaving(true)
    const notes = [
      `วันที่ย้ายออก ${moveDate}`,
      method === 'cash' ? 'คืนเงินผ่านเงินสด' : 'คืนเงินผ่าน PromptPay',
    ].join(' · ')
    try {
      await api.post(`/contracts/${id}/move-out`, {
        notes,
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
        <p className="p-8 text-center text-muted">{error}</p>
      </div>
    )
  }
  if (!preview) {
    return (
      <div>
        <TopBar title="ย้ายออก" />
        <div className="p-4"><div className="h-28 rounded-card bg-surface-2" /></div>
      </div>
    )
  }

  return (
    <div className="pb-32">
      <TopBar title={`ย้ายออก · ${preview.roomNumber}`} sub={preview.tenantName} />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2.5">
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
            วันที่ย้ายออก
            <input type="date" className={fieldCls} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              มิเตอร์ไฟสุดท้าย
              <input className={fieldCls} inputMode="decimal" value={finalElec} onChange={(e) => setFinalElec(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
              มิเตอร์น้ำสุดท้าย
              <input className={fieldCls} inputMode="decimal" value={finalWater} onChange={(e) => setFinalWater(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2">
          <strong className="text-sm">คำนวณเงินมัดจำ</strong>
          <div className="flex justify-between text-sm">
            <span>เงินมัดจำ</span>
            <strong>{preview.deposit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          {preview.unpaidInvoices.map((i) => (
            <div key={i.id} className="flex justify-between text-sm text-danger">
              <span className="text-ink-2">− {i.type === 'RENT' ? 'ค่าเช่า' : i.type === 'UTILITY' ? 'ค่าน้ำไฟ' : i.type === 'CONTRACT' ? 'ค่าแรกเข้า' : 'ส่วนต่าง'} {thaiMonth(i.month)} {i.year + 543}</span>
              <span>{Number(i.total).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ))}
          {deductions.map((d, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_96px] gap-2">
              <input
                aria-label="รายการหัก"
                className={fieldCls}
                placeholder="เช่น ทำความสะอาด"
                value={d.label}
                onChange={(e) => {
                  const next = [...deductions]
                  next[idx] = { ...next[idx], label: e.target.value }
                  setDeductions(next)
                }}
              />
              <input
                aria-label="จำนวนเงินหัก"
                className={fieldCls}
                inputMode="decimal"
                value={d.amount}
                onChange={(e) => {
                  const next = [...deductions]
                  next[idx] = { ...next[idx], amount: e.target.value }
                  setDeductions(next)
                }}
              />
            </div>
          ))}
          <button type="button" className="self-start h-8 text-sm font-bold text-primary" onClick={() => setDeductions([...deductions, { label: '', amount: '' }])}>
            + เพิ่มรายการหัก
          </button>
          <div className="border-t border-ink pt-2.5 flex justify-between items-baseline">
            <strong className="text-[15px]">{refund >= 0 ? 'คืนผู้เช่า' : 'ผู้เช่าต้องจ่ายเพิ่ม'}</strong>
            <strong className={`pf-amount text-[26px] ${refund >= 0 ? 'text-ok-fg' : 'text-danger'}`}>{bahtExact(Math.abs(refund))}</strong>
          </div>
        </section>

        <section className="bg-white rounded-card p-3.5 flex flex-col gap-2">
          <strong className="text-sm">คืนเงินผ่าน</strong>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="radio" name="refund" className="w-5 h-5 accent-primary" checked={method === 'promptpay'} onChange={() => setMethod('promptpay')} />
            โอน PromptPay
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="radio" name="refund" className="w-5 h-5 accent-primary" checked={method === 'cash'} onChange={() => setMethod('cash')} />
            เงินสด
          </label>
        </section>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-20 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 flex flex-col gap-1.5">
        <button type="button" className="h-[52px] rounded-cta bg-primary text-white text-base font-bold disabled:opacity-50" onClick={submit} disabled={saving}>
          {saving ? 'กำลังดำเนินการ...' : 'ปิดสัญญาและส่งสรุปให้ผู้เช่า'}
        </button>
        <span className="text-center text-xs text-muted">ห้องจะเปลี่ยนเป็น “ว่าง” อัตโนมัติ</span>
      </div>
    </div>
  )
}
