import { useNavigate } from 'react-router-dom'

export function TopBar({
  title,
  back = true,
  right,
}: {
  title: string
  back?: boolean
  right?: React.ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-3 h-14 flex items-center gap-2">
      {back ? (
        <button onClick={() => nav(-1)} className="p-2 -ml-2 text-gray-700" aria-label="ย้อนกลับ">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 font-semibold text-lg truncate">{title}</h1>
      {right}
    </div>
  )
}
