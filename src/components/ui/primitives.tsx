import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cx } from './cx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-[#262A6B] text-white hover:bg-[#1c1f52]',
        variant === 'secondary' && 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
        variant === 'ghost' && 'text-stone-700 hover:bg-stone-200/60',
        variant === 'danger' && 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
        className,
      )}
    />
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  required,
  className,
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-stone-800">
        {label}
        {required && (
          <span className="ml-0.5 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full rounded-md border bg-white px-2.5 text-sm text-stone-900 placeholder:text-stone-400 ' +
  'focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700/20'

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      type="text"
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={rest.id ? (invalid ? `${rest.id}-error` : `${rest.id}-hint`) : undefined}
      className={cx(inputBase, 'h-9', invalid ? 'border-red-400' : 'border-stone-300', className)}
    />
  )
}

export function TextArea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; ref?: Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={rest.id ? (invalid ? `${rest.id}-error` : `${rest.id}-hint`) : undefined}
      className={cx(inputBase, 'py-2 leading-relaxed', invalid ? 'border-red-400' : 'border-stone-300', className)}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputBase, 'h-9 border-stone-300 pr-8', className)}>
      {children}
    </select>
  )
}

export function Range({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  format,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-stone-800">
          {label}
        </label>
        <output htmlFor={id} className="text-xs tabular-nums text-stone-500">
          {format ? format(value) : `${value}${unit ?? ''}`}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-5 w-full accent-[#262A6B]"
      />
    </div>
  )
}

export function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-stone-800">
        {label}
      </label>
      <div className="flex h-9 items-center gap-2 rounded-md border border-stone-300 bg-white px-1.5">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <span className="font-mono text-xs text-stone-600">{value}</span>
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId()
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-stone-400 accent-[#262A6B]"
      />
      <label htmlFor={id} className="text-[13px] text-stone-800">
        {label}
        {hint && <span className="block text-xs text-stone-500">{hint}</span>}
      </label>
    </div>
  )
}

export function Section({
  step,
  title,
  description,
  open,
  onToggle,
  children,
}: {
  step: number
  title: string
  description?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className="border-b border-stone-200 last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-stone-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-700"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-700">
            {step}
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-stone-900">{title}</span>
            {description && <span className="block text-xs text-stone-500">{description}</span>}
          </span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className={cx('size-4 text-stone-500 transition-transform', open && 'rotate-180')}>
            <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </h2>
      <div id={id} hidden={!open} className="space-y-4 px-4 pt-1 pb-5">
        {children}
      </div>
    </section>
  )
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cx('grid grid-cols-1 gap-3', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>{children}</div>
}

