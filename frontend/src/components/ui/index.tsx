import React from 'react'
import { cls } from '../../lib/utils'

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber'
}) {
  const variants: Record<string, string> = {
    primary: 'bg-line text-white active:bg-line-dark',
    secondary: 'bg-white text-gray-700 border border-gray-300 active:bg-gray-50',
    danger: 'bg-danger text-white active:opacity-90',
    amber: 'bg-amber text-white active:opacity-90',
    ghost: 'bg-transparent text-line active:bg-line-light',
  }
  return (
    <button
      className={cls(
        'w-full rounded-xl px-4 py-3 font-semibold text-base transition disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cls('bg-white rounded-2xl shadow-sm border border-gray-100 p-4', onClick && 'cursor-pointer active:bg-gray-50', className)}
    >
      {children}
    </div>
  )
}

type BadgeKind = 'paid' | 'pending' | 'overdue' | 'info' | 'vacant' | 'green' | 'amber' | 'red' | 'gray'
export function Badge({ children, kind = 'gray' }: { children: React.ReactNode; kind?: BadgeKind }) {
  const map: Record<BadgeKind, string> = {
    paid: 'bg-line-light text-line-dark',
    green: 'bg-line-light text-line-dark',
    pending: 'bg-amber-50 text-amber-700',
    amber: 'bg-amber-50 text-amber-700',
    overdue: 'bg-red-50 text-red-600',
    red: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-700',
    vacant: 'bg-gray-100 text-gray-500',
    gray: 'bg-gray-100 text-gray-500',
  }
  return <span className={cls('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', map[kind])}>{children}</span>
}

export function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-600 mb-1">{label}</span>}
      <input
        className={cls(
          'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:border-line focus:ring-1 focus:ring-line outline-none',
          className
        )}
        {...props}
      />
    </label>
  )
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-gray-600 mb-1">{label}</span>}
      <textarea
        className={cls(
          'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:border-line focus:ring-1 focus:ring-line outline-none',
          className
        )}
        {...props}
      />
    </label>
  )
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cls('relative inline-flex h-6 w-11 items-center rounded-full transition', checked ? 'bg-line' : 'bg-gray-300')}
    >
      <span className={cls('inline-block h-5 w-5 transform rounded-full bg-white transition', checked ? 'translate-x-5' : 'translate-x-1')} />
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cls('animate-spin rounded-full border-2 border-white/40 border-t-white h-8 w-8', className)} />
  )
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls(
        'px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap',
        active ? 'bg-line text-white border-line' : 'bg-white text-gray-600 border-gray-300'
      )}
    >
      {children}
    </button>
  )
}
