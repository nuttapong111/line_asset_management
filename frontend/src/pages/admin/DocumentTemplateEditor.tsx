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

  return (
    <div className="pb-28 min-h-screen flex flex-col">
      <TopBar
        title={step === 'upload' ? 'ตั้งค่าเทมเพลตใหม่' : step === 'place' ? 'จัดวางตัวแปร' : 'พรีวิว'}
        right={
          step === 'place' ? (
            <button
              onClick={() => savePlacements()}
              disabled={saving || !templateId}
              className="text-line font-semibold text-sm px-2"
            >
              {saving ? '...' : 'บันทึก'}
            </button>
          ) : undefined
        }
      />

      {/* Step indicator */}
      <div className="px-4 pt-3 flex gap-2 text-[11px] text-gray-500">
        {(
          [
            ['upload', '1 อัปโหลด'],
            ['place', '2 วางตัวแปร'],
            ['preview', '3 พรีวิว'],
          ] as const
        ).map(([s, label]) => (
          <span
            key={s}
            className={`px-2 py-1 rounded-full ${step === s ? 'bg-line text-white' : 'bg-gray-100'}`}
          >
            {label}
          </span>
        ))}
      </div>

      {error && <p className="px-4 pt-2 text-danger text-sm">{error}</p>}

      {step === 'upload' && (
        <div className="p-4 space-y-4 flex-1">
          <div className="flex rounded-xl bg-white border border-gray-100 p-1">
            {(
              [
                ['RECEIPT', 'ใบเสร็จ'],
                ['CONTRACT', 'สัญญา'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setType(key)
                  setName(key === 'RECEIPT' ? 'ใบเสร็จรับเงิน' : 'สัญญาเช่า')
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${
                  type === key ? 'bg-line text-white' : 'text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Input label="ชื่อเทมเพลต" value={name} onChange={(e) => setName(e.target.value)} />

          <label className="block">
            <span className="text-sm font-medium text-gray-600 mb-1 block">แนบแบบฟอร์ม (รูป JPEG/PNG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="block w-full text-sm"
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
          </label>

          {bgUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
              <img src={bgUrl} alt="preview" className="w-full h-auto" />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            ตั้งเป็นค่าเริ่มต้นของ Owner
          </label>

          <Button onClick={createFromUpload} disabled={saving || !file}>
            {saving ? 'กำลังสร้าง...' : 'ถัดไป: วางตัวแปร'}
          </Button>
        </div>
      )}

      {step === 'place' && bgUrl && (
        <>
          <p className="px-4 pt-2 text-xs text-gray-500">แตะตัวแปรด้านบน แล้วลากไปวางบนแบบฟอร์ม</p>
          <div className="px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar">
            {vars.map((v) => (
              <button
                key={v.key}
                onClick={() => addVar(v)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  usedKeys.has(v.key)
                    ? 'bg-line-light border-line text-line-dark'
                    : 'bg-white border-gray-200 text-gray-700'
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
                className="relative w-full bg-white shadow-sm border border-gray-200 touch-none select-none"
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
                    className={`absolute border-2 rounded px-1 py-0.5 text-[10px] leading-tight cursor-grab active:cursor-grabbing ${
                      selectedKey === p.key
                        ? 'border-line bg-line/20 text-line-dark'
                        : 'border-line/60 bg-white/80 text-gray-800'
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
            <div className="mx-3 mt-2 p-3 bg-white rounded-xl border border-gray-100 space-y-2 text-sm">
              <div className="font-medium">{labelOf(selected.key)}</div>
              <label className="flex items-center gap-2">
                <span className="w-16 text-gray-500">ขนาด</span>
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
                <span className="w-16 text-gray-500">ความกว้าง</span>
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
                    className={`flex-1 py-1.5 rounded-lg text-xs ${
                      selected.align === a ? 'bg-line text-white' : 'bg-gray-100'
                    }`}
                  >
                    {a === 'left' ? 'ชิดซ้าย' : a === 'center' ? 'กลาง' : 'ชิดขวา'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-30">
            <div className="max-w-md mx-auto bg-white border-t border-gray-100 px-3 py-2 flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-gray-100 text-sm"
                onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
              >
                −
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-gray-100 text-sm"
                onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              >
                +
              </button>
              <button className="px-3 py-2 rounded-lg bg-red-50 text-danger text-sm" onClick={removeSelected}>
                ลบ
              </button>
              <Button className="!w-auto flex-1 !py-2 !text-sm" onClick={openPreview} disabled={saving}>
                พรีวิว
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'preview' && (
        <div className="p-4 space-y-4 flex-1">
          <p className="text-xs text-gray-400">ข้อมูลตัวอย่างใช้สำหรับพรีวิวเท่านั้น</p>
          {previewUrl ? (
            <iframe title="preview" src={previewUrl} className="w-full h-[55vh] rounded-xl border border-gray-200 bg-white" />
          ) : (
            <p className="text-gray-400 text-sm">ไม่มีพรีวิว</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
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
