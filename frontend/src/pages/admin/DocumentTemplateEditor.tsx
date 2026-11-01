import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Input } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import api from '../../lib/axios'
import { useAuthStore } from '../../store/authStore'

type TemplateType = 'CONTRACT' | 'RECEIPT'
type Align = 'left' | 'center' | 'right'

type Placement = {
  key: string
  x: number
  y: number
  fontSize: number
  align: Align
  width: number
  color?: string
}

type VarDef = { key: string; label: string; sample: string }

type Step = 'upload' | 'place' | 'preview'

function authHeaders(): Record<string, string> {
  const jwt = useAuthStore.getState().jwt
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

async function fetchBackgroundBlobUrl(id: string): Promise<string> {
  const base = api.defaults.baseURL || '/api'
  const res = await fetch(`${base}/document-templates/${id}/background`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('โหลดแบบฟอร์มไม่สำเร็จ')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export default function DocumentTemplateEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const nav = useNavigate()
  const [params] = useSearchParams()
  const typeParam = (params.get('type') === 'CONTRACT' ? 'CONTRACT' : 'RECEIPT') as TemplateType
  const ownerIdParam = params.get('ownerId') || ''

  const [step, setStep] = useState<Step>(
    isNew || params.get('step') === 'upload' ? 'upload' : 'place'
  )
  const [type, setType] = useState<TemplateType>(typeParam)
  const [name, setName] = useState(typeParam === 'RECEIPT' ? 'ใบเสร็จรับเงิน' : 'สัญญาเช่า')
  const [ownerId] = useState(ownerIdParam)
  const [templateId, setTemplateId] = useState(isNew ? '' : id!)
  const [pageWidth, setPageWidth] = useState(595)
  const [pageHeight, setPageHeight] = useState(842)
  const [bgUrl, setBgUrl] = useState<string>()
  const [file, setFile] = useState<File | null>(null)
  const [vars, setVars] = useState<VarDef[]>([])
  const [sample, setSample] = useState<Record<string, string>>({})
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedKey, setSelectedKey] = useState<string>()
  const [zoom, setZoom] = useState(1)
  const [isDefault, setIsDefault] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const [previewUrl, setPreviewUrl] = useState<string>()

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ key: string; ox: number; oy: number } | null>(null)

  useEffect(() => {
    api.get(`/document-templates/vars?type=${type}`).then(({ data }) => {
      setVars(data.vars)
      setSample(data.sample)
    })
  }, [type])

  useEffect(() => {
    if (isNew || !templateId) return
    let revoked: string | undefined
    ;(async () => {
      try {
        const { data } = await api.get(`/document-templates/${templateId}`)
        setName(data.name)
        setType(data.type)
        setPageWidth(data.pageWidth)
        setPageHeight(data.pageHeight)
        setPlacements(data.placements || [])
        setIsDefault(data.isDefault)
        const url = await fetchBackgroundBlobUrl(templateId)
        revoked = url
        setBgUrl(url)
        setStep('place')
      } catch (e: any) {
        setError(e.response?.data?.error || 'โหลดเทมเพลตไม่สำเร็จ')
      }
    })()
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [isNew, templateId])

  useEffect(() => {
    return () => {
      if (bgUrl?.startsWith('blob:')) URL.revokeObjectURL(bgUrl)
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [bgUrl, previewUrl])

  function onPickFile(f: File | null) {
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      setPageWidth(img.naturalWidth)
      setPageHeight(img.naturalHeight)
      setBgUrl(url)
    }
    img.src = url
  }

  async function createFromUpload() {
    if (!file || !bgUrl) {
      setError('กรุณาเลือกไฟล์แบบฟอร์ม')
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      fd.append('name', name)
      fd.append('pageWidth', String(pageWidth))
      fd.append('pageHeight', String(pageHeight))
      fd.append('isDefault', isDefault ? 'true' : 'false')
      if (ownerId) fd.append('ownerId', ownerId)
      const { data } = await api.post('/document-templates', fd)
      setTemplateId(data.id)
      setPlacements(data.placements || [])
      // refresh background via API so we don't rely on local file after create
      const apiBg = await fetchBackgroundBlobUrl(data.id)
      if (bgUrl.startsWith('blob:')) URL.revokeObjectURL(bgUrl)
      setBgUrl(apiBg)
      setStep('place')
    } catch (e: any) {
      setError(e.response?.data?.error || 'สร้างเทมเพลตไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const usedKeys = useMemo(() => new Set(placements.map((p) => p.key)), [placements])

  function addVar(v: VarDef) {
    if (usedKeys.has(v.key)) {
      setSelectedKey(v.key)
      return
    }
    const next: Placement = {
      key: v.key,
      x: 0.1,
      y: 0.15 + placements.length * 0.04,
      fontSize: 16,
      align: 'left',
      width: 0.45,
      color: '#111111',
    }
    setPlacements((p) => [...p, next])
    setSelectedKey(v.key)
  }

  function updatePlacement(key: string, patch: Partial<Placement>) {
    setPlacements((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function removeSelected() {
    if (!selectedKey) return
    setPlacements((list) => list.filter((p) => p.key !== selectedKey))
    setSelectedKey(undefined)
  }

  const onPointerDown = (e: React.PointerEvent, key: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedKey(key)
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const p = placements.find((x) => x.key === key)
    if (!p) return
    dragRef.current = {
      key,
      ox: (e.clientX - rect.left) / rect.width - p.x,
      oy: (e.clientY - rect.top) / rect.height - p.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.min(0.95, Math.max(0, (e.clientX - rect.left) / rect.width - dragRef.current.ox))
    const y = Math.min(0.95, Math.max(0, (e.clientY - rect.top) / rect.height - dragRef.current.oy))
    updatePlacement(dragRef.current.key, { x, y })
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  async function savePlacements() {
    if (!templateId) return
    setSaving(true)
    setError(undefined)
    try {
      await api.patch(`/document-templates/${templateId}`, {
        name,
        placements,
        isDefault,
      })
    } catch (e: any) {
      setError(e.response?.data?.error || 'บันทึกไม่สำเร็จ')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  const openPreview = useCallback(async () => {
    if (!templateId) return
    setSaving(true)
    setError(undefined)
    try {
      await api.patch(`/document-templates/${templateId}`, { name, placements, isDefault })
      const base = api.defaults.baseURL || '/api'
      const res = await fetch(`${base}/document-templates/${templateId}/preview`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ placements, values: sample }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'พรีวิวไม่สำเร็จ')
      }
      const blob = await res.blob()
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(URL.createObjectURL(blob))
      setStep('preview')
    } catch (e: any) {
      setError(e.message || 'พรีวิวไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }, [templateId, name, placements, isDefault, sample, previewUrl])

  const selected = placements.find((p) => p.key === selectedKey)
  const labelOf = (key: string) => vars.find((v) => v.key === key)?.label || key
  const aspect = pageHeight / pageWidth

  const alignTH: Record<Align, string> = { left: 'ชิดซ้าย', center: 'กลาง', right: 'ชิดขวา' }

  return (
    <div className="pb-28 min-h-screen flex flex-col bg-canvas">
      <TopBar
        title={type === 'RECEIPT' ? 'เทมเพลตเอกสาร' : 'เทมเพลตเอกสาร'}
        sub={step === 'upload' ? 'อัปโหลดพื้นหลัง' : type === 'RECEIPT' ? 'ใบเสร็จ · ค่าเริ่มต้นทุกอาคาร' : 'สัญญา · ค่าเริ่มต้นทุกอาคาร'}
        right={
          step === 'place' ? (
            <button
              onClick={() => savePlacements()}
              disabled={saving || !templateId}
              className="text-primary font-bold text-sm"
            >
              {saving ? '...' : 'บันทึก'}
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-3">
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-button bg-segment">
          {([['CONTRACT', 'สัญญา'], ['RECEIPT', 'ใบเสร็จ']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              className={`h-9 rounded-[9px] text-sm ${type === key ? 'bg-white font-bold text-ink' : 'font-semibold text-muted'}`}
              onClick={() => {
                if (step !== 'upload') return
                setType(key)
                setName(key === 'RECEIPT' ? 'ใบเสร็จรับเงิน' : 'สัญญาเช่า')
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="px-4 pt-2 text-danger text-sm">{error}</p>}

      {step === 'upload' && (
        <div className="p-4 space-y-4 flex-1">
          <Input label="ชื่อเทมเพลต" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="h-14 rounded-card border-[1.5px] border-dashed border-placeholder bg-white text-primary font-bold flex items-center justify-center">
            {file ? file.name : 'เปลี่ยนพื้นหลัง'}
            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] || null)} />
          </label>
          {bgUrl && (
            <div className="mx-auto w-[260px] rounded bg-white shadow-paper overflow-hidden">
              <img src={bgUrl} alt="พื้นหลังที่อัปโหลด" className="w-full h-auto" />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="w-5 h-5 accent-primary" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            ตั้งเป็นค่าเริ่มต้นของเจ้าของ
          </label>
          <Button onClick={createFromUpload} disabled={saving || !file}>
            {saving ? 'กำลังสร้าง...' : 'ถัดไป: วางตัวแปร'}
          </Button>
        </div>
      )}

      {step === 'place' && bgUrl && (
        <>
          <p className="px-4 pt-3 text-[13px] font-semibold text-muted">ลากตัวแปรวางบนหน้า</p>
          <div className="px-4 py-2 flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => addVar(v)}
                className={`h-[30px] px-2.5 rounded-lg text-[13px] font-semibold border ${
                  selectedKey === v.key
                    ? 'bg-primary-soft border-primary text-ok-fg'
                    : usedKeys.has(v.key)
                      ? 'bg-info-bg border-info text-info'
                      : 'bg-white border-line-soft text-ink'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="px-3 flex-1 overflow-auto">
            <div
              className="mx-auto origin-top"
              style={{
                width: `${100 * zoom}%`,
                maxWidth: `${400 * zoom}px`,
              }}
            >
              <div
                ref={canvasRef}
                className="relative w-full bg-white shadow-paper touch-none select-none"
                style={{ paddingBottom: `${aspect * 100}%` }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  src={bgUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                  draggable={false}
                />
                {placements.map((p) => (
                  <div
                    key={p.key}
                    onPointerDown={(e) => onPointerDown(e, p.key)}
                    className={`absolute border rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight cursor-grab active:cursor-grabbing ${
                      selectedKey === p.key
                        ? 'border-2 border-primary bg-primary-soft text-ok-fg'
                        : 'border-dashed border-info bg-info-bg text-info'
                    }`}
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      width: `${(p.width || 0.45) * 100}%`,
                      fontSize: Math.max(10, p.fontSize * 0.55),
                      color: p.color || '#111',
                      textAlign: p.align,
                    }}
                  >
                    {sample[p.key] || labelOf(p.key)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <div className="mx-4 mt-2 p-3 bg-white rounded-[14px] space-y-2 text-sm flex flex-col">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <strong className="text-sm">{labelOf(selected.key)} ที่เลือก</strong>
                  <div className="text-xs text-muted">x {selected.x.toFixed(2)} · y {selected.y.toFixed(2)} · ขนาด {selected.fontSize} · {alignTH[selected.align]}</div>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <span className="w-16 text-muted">ขนาด</span>
                <input
                  type="range"
                  min={10}
                  max={36}
                  value={selected.fontSize}
                  onChange={(e) => updatePlacement(selected.key, { fontSize: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 text-right">{selected.fontSize}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-16 text-muted">ความกว้าง</span>
                <input
                  type="range"
                  min={15}
                  max={90}
                  value={Math.round((selected.width || 0.45) * 100)}
                  onChange={(e) => updatePlacement(selected.key, { width: Number(e.target.value) / 100 })}
                  className="flex-1"
                />
              </label>
              <div className="flex gap-2">
                {(['left', 'center', 'right'] as Align[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => updatePlacement(selected.key, { align: a })}
                    className={`flex-1 py-1.5 rounded-[10px] text-xs font-semibold ${
                      selected.align === a ? 'bg-primary text-white' : 'bg-surface-2'
                    }`}
                  >
                    {alignTH[a]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fixed bottom-0 inset-x-0 z-30 max-w-liff mx-auto bg-white border-t border-line-soft px-4 pt-3 pb-6 grid grid-cols-2 gap-2.5">
            <button type="button" className="h-[50px] rounded-cta border-[1.5px] border-line-soft bg-white text-[15px] font-semibold" onClick={removeSelected}>
              ลบตัวแปร
            </button>
            <button type="button" className="h-[50px] rounded-cta bg-primary text-white text-[15px] font-bold disabled:opacity-50" onClick={openPreview} disabled={saving}>
              ดูตัวอย่าง PDF
            </button>
            <button type="button" className="col-span-2 text-xs text-muted" onClick={() => setZoom((z) => (z > 1.2 ? 1 : 1.4))}>
              {zoom > 1 ? 'ย่อหน้า' : 'ขยายหน้า'}
            </button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <div className="p-4 space-y-4 flex-1">
          <p className="text-xs text-muted">ข้อมูลตัวอย่างใช้สำหรับพรีวิวเท่านั้น</p>
          {previewUrl ? (
            <iframe title="ตัวอย่าง PDF" src={previewUrl} className="w-full h-[55vh] rounded bg-white shadow-paper" />
          ) : (
            <p className="text-muted text-sm">ไม่มีพรีวิว</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-5 h-5 accent-primary"
              checked={isDefault}
              onChange={async (e) => {
                setIsDefault(e.target.checked)
                if (templateId) {
                  await api.patch(`/document-templates/${templateId}`, { isDefault: e.target.checked })
                }
              }}
            />
            ตั้งเป็นค่าเริ่มต้น
          </label>
          <Button variant="secondary" onClick={() => setStep('place')}>
            แก้ตำแหน่ง
          </Button>
          <Button
            onClick={async () => {
              await savePlacements()
              nav(`/admin/document-templates?type=${type}${ownerId ? `&ownerId=${ownerId}` : ''}`)
            }}
            disabled={saving}
          >
            บันทึกเทมเพลต
          </Button>
        </div>
      )}
    </div>
  )
}
