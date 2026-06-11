import { cls } from '../../lib/utils'

const STEPS = ['ข้อมูล', 'สัญญา', 'เชิญ']

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((label, i) => {
        const n = i + 1
        const active = n === step
        const done = n < step
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cls(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                  active ? 'bg-line text-white' : done ? 'bg-line-light text-line-dark' : 'bg-gray-200 text-gray-400'
                )}
              >
                {done ? '✓' : n}
              </div>
              <span className={cls('text-[10px] mt-1', active ? 'text-line' : 'text-gray-400')}>{label}</span>
            </div>
            {n < 3 && <div className={cls('w-8 h-0.5 mb-4', done ? 'bg-line' : 'bg-gray-200')} />}
          </div>
        )
      })}
    </div>
  )
}
