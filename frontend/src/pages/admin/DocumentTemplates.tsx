import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TopBar } from '../../components/layout/TopBar'
import { useAuth } from '../../hooks/useAuth'
import api from '../../lib/axios'
import { cls } from '../../lib/utils'

type TemplateType = 'CONTRACT' | 'RECEIPT'

type TemplateItem = {
  id: string
  name: string
  type: TemplateType
  isDefault: boolean
  propertyName: string | null
  ownerId: string
  updatedAt: string
}

type OwnerOpt = { id: string; name: string }

export default function DocumentTemplates() {
  const nav = useNavigate()
  const { role } = useAuth()
  const [params, setParams] = useSearchParams()
  const type = (params.get('type') === 'CONTRACT' ? 'CONTRACT' : 'RECEIPT') as TemplateType
  const [ownerId, setOwnerId] = useState(params.get('ownerId') || '')
  const [owners, setOwners] = useState<OwnerOpt[]>([])
  const [list, setList] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const isAdmin = role === 'ADMIN'

  useEffect(() => {
    if (!isAdmin) return
    api.get('/owners').then(({ data }) => setOwners(data.map((o: OwnerOpt) => ({ id: o.id, name: o.name })))).catch(() => {})
  }, [isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const q = new URLSearchParams({ type })
      if (isAdmin && ownerId) q.set('ownerId', ownerId)
      const { data } = await api.get(`/document-templates?${q}`)
      setList(data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(typeof msg === 'string' ? msg : 'โหลดไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [type, ownerId, isAdmin])

  useEffect(() => {
    load()
  }, [load])

  function setType(t: TemplateType) {
    const next = new URLSearchParams(params)
    next.set('type', t)
    setParams(next, { replace: true })
  }

  async function setDefault(id: string) {
    await api.patch(`/document-templates/${id}`, { isDefault: true })
    load()
  }

  async function remove(id: string) {
    if (!confirm('ลบเทมเพลตนี้?')) return
    await api.delete(`/document-templates/${id}`)
    load()
  }

  const canAdd = !isAdmin || !!ownerId
  const current = list.find((t) => t.isDefault) || list[0]

  return (
    <div className="pb-8">
      <TopBar
        title="เทมเพลตเอกสาร"
        sub={type === 'RECEIPT' ? 'ใบเสร็จ · ค่าเริ่มต้นทุกอาคาร' : 'สัญญา · ค่าเริ่มต้นทุกอาคาร'}
        right={
          current ? (
            <button
              type="button"
              className="text-primary text-sm font-bold"
              onClick={() => nav(`/admin/document-templates/${current.id}${isAdmin && ownerId ? `?ownerId=${ownerId}` : ''}`)}
            >
              จัดวาง
            </button>
          ) : undefined
        }
      />
      <div className="px-4 py-3.5 flex flex-col gap-3">
        {isAdmin && (
          <select
            aria-label="เลือกเจ้าของ"
            className="h-11 rounded-input border-[1.5px] border-line-input px-3 bg-white"
            value={ownerId}
            onChange={(e) => {
              setOwnerId(e.target.value)
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('ownerId', e.target.value)
              else next.delete('ownerId')
              setParams(next, { replace: true })
            }}
          >
            <option value="">ทุกเจ้าของ</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}

        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-button bg-segment">
          {([['CONTRACT', 'สัญญา'], ['RECEIPT', 'ใบเสร็จ']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={type === key}
              className={cls('h-9 rounded-[9px] text-sm', type === key ? 'bg-white font-bold text-ink' : 'font-semibold text-muted')}
              onClick={() => setType(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {loading && <div className="h-40 rounded bg-surface-2" />}
        {!loading && list.length === 0 && (
          <p className="text-sm text-muted text-center py-6">
            ยังไม่มีเทมเพลต{type === 'RECEIPT' ? 'ใบเสร็จ' : 'สัญญา'}
          </p>
        )}

        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            className="bg-white rounded-[14px] px-3.5 py-3 text-left flex flex-col gap-2"
            onClick={() => nav(`/admin/document-templates/${t.id}${isAdmin && ownerId ? `?ownerId=${ownerId}` : ''}`)}
          >
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <strong className="text-sm">{t.name}</strong>
                <div className="text-xs text-muted">{t.propertyName ? t.propertyName : 'ใช้กับทุกอาคาร'}</div>
              </div>
              {t.isDefault && <span className="px-2.5 py-0.5 rounded-full bg-ok-bg text-ok-fg text-xs font-bold">ค่าเริ่มต้น</span>}
            </div>
            <div className="flex gap-2">
              {!t.isDefault && (
                <span
                  role="button"
                  className="text-[13px] font-semibold text-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    void setDefault(t.id)
                  }}
                >
                  ตั้งเป็นค่าเริ่มต้น
                </span>
              )}
              <span
                role="button"
                className="text-[13px] font-semibold text-danger"
                onClick={(e) => {
                  e.stopPropagation()
                  void remove(t.id)
                }}
              >
                ลบ
              </span>
            </div>
          </button>
        ))}

        <button
          type="button"
          disabled={!canAdd}
          onClick={() => {
            const q = new URLSearchParams({ type, step: 'upload' })
            if (isAdmin && ownerId) q.set('ownerId', ownerId)
            nav(`/admin/document-templates/new?${q}`)
          }}
          className="h-14 rounded-card border-[1.5px] border-dashed border-placeholder text-primary font-bold disabled:opacity-40"
        >
          + เพิ่มเทมเพลต
        </button>
        {isAdmin && !ownerId && <p className="text-xs text-warn-fg text-center">เลือกเจ้าของก่อนเพื่อเพิ่มเทมเพลต</p>}
      </div>
    </div>
  )
}
