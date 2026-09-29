import type { CertificateConfig } from '../../types/certificate'
import { formatDate, formatDateRange } from '../../utils/date'

export interface VariableDef {
  key: string
  label: string
  /** Shown in the variable picker. */
  help: string
}

/** Variables available in the certificate wording, in the order shown in the UI. */
export const VARIABLES: VariableDef[] = [
  { key: 'salutation', label: 'Salutation', help: 'Shri., Dr., Ms. …' },
  { key: 'name', label: 'Name', help: 'Participant full name' },
  { key: 'designation', label: 'Designation', help: 'Participant designation' },
  { key: 'department', label: 'Department', help: 'Participant department' },
  { key: 'institution', label: 'Institution', help: 'Participant institution / organisation' },
  { key: 'affiliation', label: 'Affiliation', help: 'Designation, department and institution joined with commas (empty parts skipped)' },
  { key: 'event_name', label: 'Event name', help: 'Name of the event' },
  { key: 'event_type', label: 'Event type', help: 'Workshop, FDP, seminar …' },
  { key: 'organizer', label: 'Organizer', help: 'Organising body' },
  { key: 'venue', label: 'Venue', help: 'Where the event was held' },
  { key: 'start_date', label: 'Start date', help: 'Formatted start date' },
  { key: 'end_date', label: 'End date', help: 'Formatted end date' },
  { key: 'date_range', label: 'Date range', help: '"from X to Y", or "on X" for a single-day event' },
  { key: 'date', label: 'Issue date', help: 'Date of issue' },
  { key: 'description', label: 'Description', help: 'Additional description' },
  { key: 'issuer', label: 'Issuing institution', help: 'Institution name from the heading' },
]

const KNOWN = new Set(VARIABLES.map((v) => v.key))

/** Escape user-entered values so they are never interpreted as markup. */
export function escapeMarkup(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').replace(/([\\*^#{}])/g, '\\$1')
}

/**
 * Values of every variable. Dates are pre-formatted and may contain `^{…}`
 * superscript markup (e.g. 24^{th}); everything else is escaped.
 */
export function buildVariables(cfg: CertificateConfig): Record<string, string> {
  const p = cfg.participant
  const e = cfg.event
  const fmt = cfg.design.dateFormat
  const raw: Record<string, string> = {
    salutation: p.salutation,
    name: p.name,
    designation: p.designation,
    department: p.department,
    institution: p.institution,
    affiliation: [p.designation, p.department, p.institution]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', '),
    event_name: e.name,
    event_type: e.type,
    organizer: e.organizer,
    venue: e.venue,
    description: e.description,
    issuer: cfg.institution.name,
  }
  const vars: Record<string, string> = {}
  for (const [k, val] of Object.entries(raw)) vars[k] = escapeMarkup(val.trim())
  vars.start_date = formatDate(e.startDate, fmt)
  vars.end_date = formatDate(e.endDate, fmt)
  vars.date_range = formatDateRange(e.startDate, e.endDate, fmt)
  vars.date = formatDate(cfg.issueDate, fmt)
  return vars
}

function applyFilter(value: string, filter: string | undefined): string {
  switch (filter) {
    case 'upper':
      return value.toUpperCase()
    case 'lower':
      return value.toLowerCase()
    case 'title':
      return value.replace(/\b(\p{L})(\p{L}*)/gu, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())
    default:
      return value
  }
}

export interface TemplateIssue {
  message: string
}

/** Find unknown variables / unbalanced sections — shown as warnings in the editor. */
export function checkTemplate(template: string): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const unknown = new Set<string>()
  const stack: string[] = []
  const re = /\{\{\s*([#^/]?)\s*([a-z_]+)?\s*(?:\|\s*([a-z]+))?\s*\}\}/gi
  for (const m of template.matchAll(re)) {
    const [, sigil, key = '', filter] = m
    if (sigil === '#' || sigil === '^') stack.push(key)
    else if (sigil === '/') {
      if (stack.pop() !== key) issues.push({ message: `Section {{/${key}}} does not match an opening {{#${key}}}.` })
    }
    if (key && !KNOWN.has(key)) unknown.add(key)
    if (filter && !['upper', 'lower', 'title'].includes(filter))
      issues.push({ message: `Unknown filter "|${filter}" (use upper, lower or title).` })
  }
  for (const k of stack) issues.push({ message: `Section {{#${k}}} is never closed with {{/${k}}}.` })
  for (const k of unknown) issues.push({ message: `Unknown variable {{${k}}}.` })
  return issues
}

/**
 * Expand `{{var}}`, `{{var|upper}}`, `{{#var}}…{{/var}}` (only if var is
 * non-empty) and `{{^var}}…{{/var}}` (only if empty).
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  // Emphasis wrapped around an empty variable (e.g. *{{affiliation}}*) would
  // otherwise leave a bare ** behind and turn the rest of the text bold.
  let out = template.replace(/(\*{1,3})\{\{\s*([a-z_]+)\s*(?:\|\s*[a-z]+\s*)?\}\}\1(?!\*)/gi, (m, _stars: string, key: string) =>
    vars[key.toLowerCase()]?.trim() ? m : '',
  )
  // Sections, innermost first, repeated until stable.
  const section = /\{\{\s*([#^])\s*([a-z_]+)\s*\}\}((?:(?!\{\{\s*[#^])[\s\S])*?)\{\{\s*\/\s*\2\s*\}\}/gi
  for (let i = 0; i < 10; i++) {
    const next = out.replace(section, (_, sigil: string, key: string, inner: string) => {
      const has = Boolean(vars[key]?.trim())
      return (sigil === '#') === has ? inner : ''
    })
    if (next === out) break
    out = next
  }
  return out.replace(/\{\{\s*([a-z_]+)\s*(?:\|\s*([a-z]+))?\s*\}\}/gi, (_, key: string, filter?: string) =>
    applyFilter(vars[key.toLowerCase()] ?? '', filter?.toLowerCase()),
  )
}
