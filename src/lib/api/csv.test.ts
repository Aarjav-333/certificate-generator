import { describe, expect, it } from 'vitest'
import { certificateBaseName, mergeRecord, uniqueFileNames } from './batch.js'
import { CSV_TEMPLATE, csvToRecords, normalizeCsvDate, parseCsv } from './csv.js'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and newlines in fields, CRLF and BOM', () => {
    const text = '\uFEFFname,venue\r\n"Doe, Jane","Hall ""A""\nBlock 2"\r\n\r\nRahul Kumar,Kochi\n'
    expect(parseCsv(text)).toEqual([
      ['name', 'venue'],
      ['Doe, Jane', 'Hall "A"\nBlock 2'],
      ['Rahul Kumar', 'Kochi'],
    ])
  })
})

describe('csvToRecords', () => {
  it('maps columns (with aliases) onto certificate fields and skips empty cells', () => {
    const { records, ignoredColumns, issues } = csvToRecords(
      'Name,Designation,Institution,Event Name,venue,start_date,end_date,shoe_size\nAarjav Oravakandi,Student,CET,Workshop,Trivandrum,2026-10-10,12/10/2026,42\nRahul Kumar,,CET,,,,,\n',
      100,
    )
    expect(issues).toEqual([])
    expect(ignoredColumns).toEqual(['shoe_size'])
    expect(records[0]).toEqual({
      participant: { name: 'Aarjav Oravakandi', designation: 'Student', institution: 'CET' },
      event: { name: 'Workshop', venue: 'Trivandrum', startDate: '2026-10-10', endDate: '2026-10-12' },
    })
    expect(records[1]).toEqual({ participant: { name: 'Rahul Kumar', institution: 'CET' } })
  })

  it('reports bad dates, a missing name column and too many rows', () => {
    expect(csvToRecords('name,start_date\nA,31/02/2026\n', 10).issues[0].message).toMatch(/Row 2: "31\/02\/2026".*not a valid date/)
    expect(csvToRecords('designation\nStudent\n', 10).issues[0].message).toMatch(/needs a "name" column/)
    expect(csvToRecords('name\nA\nB\nC\n', 2).issues[0].message).toMatch(/At most 2 rows/)
    expect(csvToRecords('name\n', 10).issues[0].message).toMatch(/at least one data row/)
  })

  it('parses the downloadable template', () => {
    const { records, issues } = csvToRecords(CSV_TEMPLATE, 10)
    expect(issues).toEqual([])
    expect(records.map((r) => r.participant?.name)).toEqual(['Aarjav Oravakandi', 'Rahul Kumar'])
  })

  it('normalises dates', () => {
    expect(normalizeCsvDate('2026-10-10')).toBe('2026-10-10')
    expect(normalizeCsvDate('5.3.2026')).toBe('2026-03-05')
    expect(normalizeCsvDate('2026/10/10')).toBeNull()
  })
})

describe('batch helpers', () => {
  it('merges sections field by field and replaces other values', () => {
    const base = { template: 'classic', participant: { designation: 'Student' }, event: { name: 'Workshop', venue: 'Kochi' }, signatories: [{ name: 'A' }] }
    expect(mergeRecord(base, { participant: { name: 'X' }, event: { venue: 'Trivandrum' }, signatories: [] })).toEqual({
      template: 'classic',
      participant: { designation: 'Student', name: 'X' },
      event: { name: 'Workshop', venue: 'Trivandrum' },
      signatories: [],
    })
  })

  it('produces safe, unique file names that cannot traverse paths', () => {
    expect(certificateBaseName('Aarjav Oravakandi', 'x')).toBe('Aarjav-Oravakandi')
    expect(certificateBaseName('../../etc/passwd', 'x')).toBe('etc-passwd')
    expect(certificateBaseName('C:\\Windows\\system32', 'x')).toBe('C-Windows-system32')
    expect(certificateBaseName('…', 'certificate-3')).toBe('certificate-3')
    expect(uniqueFileNames(['A', 'a', 'B', 'A'], 'pdf')).toEqual(['A.pdf', 'a-2.pdf', 'B.pdf', 'A-3.pdf'])
  })
})
