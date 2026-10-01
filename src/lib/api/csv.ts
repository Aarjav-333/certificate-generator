import { parseIsoDate } from '../../utils/date.js'
import type { FieldIssue } from './errors.js'

/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * line breaks inside quotes, CRLF/LF line endings and a UTF-8 BOM.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  // Drop completely empty lines.
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** CSV column → certificate field. Several spellings are accepted per column. */
const COLUMNS: Record<string, [section: string | null, field: string]> = {
  name: ['participant', 'name'],
  participant_name: ['participant', 'name'],
  full_name: ['participant', 'name'],
  salutation: ['participant', 'salutation'],
  title: ['participant', 'salutation'],
  designation: ['participant', 'designation'],
  department: ['participant', 'department'],
  institution: ['participant', 'institution'],
  organization: ['participant', 'institution'],
  organisation: ['participant', 'institution'],
  event_name: ['event', 'name'],
  event: ['event', 'name'],
  event_type: ['event', 'type'],
  organizer: ['event', 'organizer'],
  organiser: ['event', 'organizer'],
  venue: ['event', 'venue'],
  start_date: ['event', 'startDate'],
  end_date: ['event', 'endDate'],
  description: ['event', 'description'],
  date: [null, 'issueDate'],
  issue_date: [null, 'issueDate'],
}

export const CSV_TEMPLATE =
  'name,salutation,designation,department,institution,event_name,event_type,organizer,venue,start_date,end_date\n' +
  'Aarjav Oravakandi,Shri.,Student Coordinator,Department of Computer Science,College of Engineering Trivandrum,Sample Technical Event,three-day workshop,Sample Organization,Thiruvananthapuram,2026-10-10,2026-10-12\n' +
  'Rahul Kumar,,Student,MCA,College of Engineering Trivandrum,Sample Technical Event,three-day workshop,Sample Organization,Thiruvananthapuram,2026-10-10,2026-10-12\n'

const normHeader = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

/** Accept 2026-10-10, as well as 10/10/2026 and 10-10-2026 (day first). */
export function normalizeCsvDate(v: string): string | null {
  const t = v.trim()
  if (!t) return ''
  if (parseIsoDate(t)) return t
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (parseIsoDate(iso)) return iso
  }
  return null
}

/** One CSV row as a partial certificate (same shape as an API batch record). */
export interface CsvRecord {
  participant?: Partial<Record<'salutation' | 'name' | 'designation' | 'department' | 'institution', string>>
  event?: Partial<Record<'name' | 'type' | 'organizer' | 'venue' | 'startDate' | 'endDate' | 'description', string>>
  issueDate?: string
}

export interface CsvImport {
  /** One partial certificate per data row, in the API/batch record shape. */
  records: CsvRecord[]
  /** Columns that were not recognised (ignored). */
  ignoredColumns: string[]
  issues: FieldIssue[]
}

/**
 * Convert CSV text into batch records. Cells that are empty are left out so
 * the shared settings (e.g. the event in the current form) still apply.
 */
export function csvToRecords(text: string, maxRows: number): CsvImport {
  const rows = parseCsv(text)
  const issues: FieldIssue[] = []
  if (rows.length < 2) return { records: [], ignoredColumns: [], issues: [{ field: 'csv', message: 'The CSV needs a header row and at least one data row.' }] }
  const headers = rows[0].map(normHeader)
  const ignoredColumns = rows[0].filter((_, i) => !COLUMNS[headers[i]])
  if (!headers.some((h) => COLUMNS[h]?.[1] === 'name' && COLUMNS[h]?.[0] === 'participant'))
    issues.push({ field: 'csv', message: 'The CSV needs a "name" column for the participant name.' })

  const data = rows.slice(1)
  if (data.length > maxRows) issues.push({ field: 'csv', message: `At most ${maxRows} rows can be generated at once (got ${data.length}).` })

  const records = data.slice(0, maxRows).map((cells, r) => {
    const rec: Record<string, Record<string, string> | string> = {} // built from the fixed COLUMNS map only
    headers.forEach((h, i) => {
      const target = COLUMNS[h]
      const value = (cells[i] ?? '').trim()
      if (!target || value === '') return
      const [section, field] = target
      let v = value
      if (/date$/i.test(field)) {
        const d = normalizeCsvDate(value)
        if (d === null) {
          issues.push({ field: `row ${r + 2}`, message: `Row ${r + 2}: "${value}" in column "${rows[0][i]}" is not a valid date (use YYYY-MM-DD).` })
          return
        }
        v = d
      }
      if (section) rec[section] = { ...((rec[section] as Record<string, string>) ?? {}), [field]: v }
      else rec[field] = v
    })
    return rec as CsvRecord
  })
  return { records, ignoredColumns, issues }
}
