import { Spinner } from '../components/ui'

export default function Splash({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-line flex flex-col items-center justify-center text-white px-8">
      <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-5">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12l9-9 9 9M5 10v10h14V10" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold">PropFlow</h1>
      <p className="text-white/80 mt-1 mb-8">ระบบจัดการบ้านเช่า</p>
      {error ? (
        <p className="text-white/90 text-center text-sm bg-black/20 rounded-xl p-3">{error}</p>
      ) : (
        <Spinner />
      )}
    </div>
  )
}
