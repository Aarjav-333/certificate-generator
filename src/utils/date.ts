import type { DateFormatId } from '../types/certificate.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const DATE_FORMATS: Array<{ id: DateFormatId; label: string }> = [
  { id: 'D MMMM YYYY', label: '20 September 2026' },
  { id: 'Do MMMM YYYY', label: '20th September 2026' },
  { id: 'Do^ MMMM YYYY', label: '20ᵗʰ September 2026 (superscript)' },
  { id: 'Do^ MMM YYYY', label: '20ᵗʰ Sep 2026 (superscript)' },
  { id: 'D MMM YYYY', label: '20 Sep 2026' },
  { id: 'MMMM D, YYYY', label: 'September 20, 2026' },
  { id: 'DD/MM/YYYY', label: '20/09/2026' },
  { id: 'DD-MM-YYYY', label: '20-09-2026' },
  { id: 'DD.MM.YYYY', label: '20.09.2026' },
]

export function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso?.trim() ?? '')
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return { y, m: mo, d }
}

export function ordinalSuffix(n: number): string {
  const t = n % 100
  if (t >= 11 && t <= 13) return 'th'
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Format an ISO date. Superscript formats emit `^{th}` markup which the rich
 * text renderer turns into a raised, smaller run.
 */
export function formatDate(iso: string, fmt: DateFormatId): string {
  const p = parseIsoDate(iso)
  if (!p) return ''
  const { y, m, d } = p
  const month = MONTHS[m - 1]
  switch (fmt) {
    case 'D MMMM YYYY':
      return `${d} ${month} ${y}`
    case 'Do MMMM YYYY':
      return `${d}${ordinalSuffix(d)} ${month} ${y}`
    case 'Do^ MMMM YYYY':
      return `${d}^{${ordinalSuffix(d)}} ${month} ${y}`
    case 'Do^ MMM YYYY':
      return `${d}^{${ordinalSuffix(d)}} ${month.slice(0, 3)} ${y}`
    case 'D MMM YYYY':
      return `${d} ${month.slice(0, 3)} ${y}`
    case 'MMMM D, YYYY':
      return `${month} ${d}, ${y}`
    case 'DD/MM/YYYY':
      return `${pad(d)}/${pad(m)}/${y}`
    case 'DD-MM-YYYY':
      return `${pad(d)}-${pad(m)}-${y}`
    case 'DD.MM.YYYY':
      return `${pad(d)}.${pad(m)}.${y}`
  }
}

/** "from X to Y", or "on X" when both dates are the same / only one is set. */
export function formatDateRange(start: string, end: string, fmt: DateFormatId): string {
  const s = formatDate(start, fmt)
  const e = formatDate(end, fmt)
  if (s && e && s !== e) return `from ${s} to ${e}`
  if (s || e) return `on ${s || e}`
  return ''
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
