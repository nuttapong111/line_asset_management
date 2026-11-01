import { useNavigate } from 'react-router-dom'

export function TopBar({
  title,
  sub,
  back = true,
  right,
}: {
  title: string
  sub?: string
  back?: boolean
  right?: React.ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-line-soft px-1.5 min-h-14 flex items-center gap-1">
      {back ? (
        <button onClick={() => nav(-1)} className="w-11 h-11 shrink-0 flex items-center justify-center text-ink" aria-label="ย้อนกลับ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="flex-1 min-w-0 py-2">
        <h1 className="font-display font-bold text-lg truncate leading-tight">{title}</h1>
        {sub && <p className="text-xs text-muted truncate">{sub}</p>}
      </div>
      {right && <div className="pr-2 shrink-0">{right}</div>}
    </div>
  )
}
