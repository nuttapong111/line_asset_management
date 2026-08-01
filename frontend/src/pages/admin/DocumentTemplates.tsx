import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Card } from '../../components/ui'
import { TopBar } from '../../components/layout/TopBar'
import { BottomNav } from '../../components/layout/BottomNav'
import { useAuth } from '../../hooks/useAuth'
import api from '../../lib/axios'

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
    api
      .get('/owners')
      .then(({ data }) => setOwners(data.map((o: OwnerOpt) => ({ id: o.id, name: o.name }))))
      .catch(() => {})
  }, [isAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const q = new URLSearchParams({ type })
      if (isAdmin && ownerId) q.set('ownerId', ownerId)
      const { data } = await api.get(`/document-templates?${q}`)
      setList(data)
    } catch (e: any) {
      setError(e.response?.data?.error || 'โหลดไม่สำเร็จ')
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

  return (
    <div className="pb-24">
      <TopBar title="เทมเพลตเอกสาร" />
      <div className="p-4 space-y-4">
        {isAdmin && (
          <label className="block">
            <span className="text-sm text-gray-600 mb-1 block">เลือก Owner</span>
            <select
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 bg-white"
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value)
                const next = new URLSearchParams(params)
                if (e.target.value) next.set('ownerId', e.target.value)
                else next.delete('ownerId')
                setParams(next, { replace: true })
              }}
            >
              <option value="">— ทุก Owner —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex rounded-xl bg-white border border-gray-100 p-1">
          {(
            [
              ['RECEIPT', 'ใบเสร็จ'],
              ['CONTRACT', 'สัญญา'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                type === key ? 'bg-line text-white' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}
        {loading && <p className="text-gray-400 text-sm text-center py-8">กำลังโหลด...</p>}

        {!loading && list.length === 0 && (
          <Card className="text-center text-gray-500 text-sm py-8">
            ยังไม่มีเทมเพลต{type === 'RECEIPT' ? 'ใบเสร็จ' : 'สัญญา'}
            <br />
            <span className="text-xs text-gray-400">อัปโหลดแบบฟอร์มแล้วลากตัวแปรไปวางได้</span>
          </Card>
        )}

        {list.map((t) => (
          <Card key={t.id} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-xs text-gray-400">
                  {t.propertyName ? `ทรัพย์สิน: ${t.propertyName}` : 'ใช้กับทุกทรัพย์สินของ Owner'}
                </div>
              </div>
              {t.isDefault && <Badge kind="green">ค่าเริ่มต้น</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="text-sm text-line font-medium px-3 py-1.5 bg-line-light rounded-lg"
                onClick={() =>
                  nav(
                    `/admin/document-templates/${t.id}${isAdmin && ownerId ? `?ownerId=${ownerId}` : ''}`
                  )
                }
              >
                จัดวางตัวแปร
              </button>
              {!t.isDefault && (
                <button
                  className="text-sm text-gray-600 px-3 py-1.5 bg-gray-100 rounded-lg"
                  onClick={() => setDefault(t.id)}
                >
                  ตั้งเป็นค่าเริ่มต้น
                </button>
              )}
              <button className="text-sm text-danger px-3 py-1.5 bg-red-50 rounded-lg" onClick={() => remove(t.id)}>
                ลบ
              </button>
            </div>
          </Card>
        ))}

        <button
          disabled={!canAdd}
          onClick={() => {
            const q = new URLSearchParams({ type, step: 'upload' })
            if (isAdmin && ownerId) q.set('ownerId', ownerId)
            nav(`/admin/document-templates/new?${q}`)
          }}
          className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 text-gray-500 font-medium active:bg-gray-50 disabled:opacity-40"
        >
          + เพิ่มเทมเพลต
        </button>
        {isAdmin && !ownerId && (
          <p className="text-xs text-amber-700 text-center">เลือก Owner ก่อนเพื่อเพิ่มเทมเพลต</p>
        )}
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
