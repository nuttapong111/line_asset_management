import { cls } from '../../lib/utils'

const STEPS = ['1 ผู้เช่า', '2 สัญญา', '3 ส่งคำเชิญ']

export function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <ol aria-label="ขั้นตอน" className="grid grid-cols-3 gap-1.5 list-none m-0 p-0">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        const current = n === step
        const on = done || current
        return (
          <li key={label} className="flex flex-col gap-1.5">
            <span className={cls('h-1 rounded', on ? 'bg-primary' : 'bg-line-soft')} />
            <span className={cls('text-xs', on ? 'font-bold text-primary' : 'font-semibold text-muted')}>
              {label}
              {done ? ' ✓' : ''}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
