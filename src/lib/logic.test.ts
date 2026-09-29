import { describe, expect, it } from 'vitest'
import { signatureRows } from '../templates/engine'
import { formatDate, formatDateRange, ordinalSuffix, parseIsoDate } from '../utils/date'
import { applyTemplate, blankConfig, ConfigImportError, parseConfigJson, serializeConfig } from './config'
import { getTemplate } from '../templates'
import { exportErrors, liveErrors } from './validation'

describe('dates', () => {
  it('formats every supported style', () => {
    expect(formatDate('2026-09-20', 'D MMMM YYYY')).toBe('20 September 2026')
    expect(formatDate('2026-09-20', 'Do MMMM YYYY')).toBe('20th September 2026')
    expect(formatDate('2026-09-22', 'Do^ MMM YYYY')).toBe('22^{nd} Sep 2026')
    expect(formatDate('2026-09-01', 'Do^ MMMM YYYY')).toBe('1^{st} September 2026')
    expect(formatDate('2026-09-20', 'DD/MM/YYYY')).toBe('20/09/2026')
    expect(formatDate('2026-09-05', 'MMMM D, YYYY')).toBe('September 5, 2026')
  })

  it('uses correct ordinals including 11th–13th', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinalSuffix)).toEqual([
      'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'st', 'nd', 'rd', 'st',
    ])
  })

  it('rejects invalid dates', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(formatDate('not a date', 'D MMMM YYYY')).toBe('')
  })

  it('renders ranges and single-day events', () => {
    expect(formatDateRange('2026-10-10', '2026-10-12', 'D MMMM YYYY')).toBe('from 10 October 2026 to 12 October 2026')
    expect(formatDateRange('2026-10-10', '2026-10-10', 'D MMMM YYYY')).toBe('on 10 October 2026')
    expect(formatDateRange('', '', 'D MMMM YYYY')).toBe('')
  })
})

describe('signatureRows', () => {
  it('lays out 1–6 signatories', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => signatureRows(n, 'auto'))).toEqual([[], [1], [2], [3], [4], [5], [3, 3]])
    expect(signatureRows(5, 'two-rows')).toEqual([3, 2])
    expect(signatureRows(6, 'one-row')).toEqual([6])
  })
})

describe('validation', () => {
  it('requires the essentials before export', () => {
    const cfg = blankConfig('reference')
    const fields = exportErrors(cfg).map((e) => e.field)
    expect(fields).toEqual(expect.arrayContaining(['inst-name', 'participant-name', 'event-name', `sig-${cfg.signatories[0].id}-name`]))
  })

  it('flags an end date before the start date', () => {
    const cfg = blankConfig('reference')
    cfg.event.startDate = '2026-09-22'
    cfg.event.endDate = '2026-09-20'
    expect(liveErrors(cfg)).toEqual([{ field: 'event-end', message: 'End date is before the start date.' }])
  })
})

describe('config import/export', () => {
  it('round-trips through JSON', () => {
    const cfg = blankConfig('classic')
    cfg.participant.name = 'John Doe'
    expect(parseConfigJson(serializeConfig(cfg))).toEqual(cfg)
  })

  it('sanitises hostile or malformed input', () => {
    const cfg = parseConfigJson(
      JSON.stringify({
        templateId: 'nope',
        participant: { name: 42 },
        institution: { name: 'X', logo: { dataUrl: 'javascript:alert(1)', mime: 'image/png', width: 1, height: 1 }, logoSize: 9999 },
        design: { accentColor: 'red; background:url(x)', bodyFontSize: -5, borderStyle: 'fancy' },
        signatories: Array.from({ length: 20 }, () => ({ name: 'S' })),
      }),
    )
    expect(cfg.templateId).toBe('reference')
    expect(cfg.participant.name).toBe('')
    expect(cfg.institution.logo).toBeNull()
    expect(cfg.institution.logoSize).toBe(160)
    expect(cfg.design.accentColor).toBe(getTemplate('reference').defaults.design.accentColor)
    expect(cfg.design.bodyFontSize).toBe(8)
    expect(cfg.design.borderStyle).toBe('none')
    expect(cfg.signatories).toHaveLength(6)
  })

  it('rejects non-JSON and foreign files', () => {
    expect(() => parseConfigJson('{oops')).toThrow(ConfigImportError)
    expect(() => parseConfigJson(JSON.stringify({ format: 'something-else', config: {} }))).toThrow(ConfigImportError)
  })
})

describe('applyTemplate', () => {
  it('keeps custom wording but adopts the new design', () => {
    const cfg = blankConfig('reference')
    cfg.body = 'My own wording for {{name}}'
    const next = applyTemplate(cfg, getTemplate('classic'))
    expect(next.body).toBe('My own wording for {{name}}')
    expect(next.design.primaryFont).toBe('cinzel')
  })

  it('swaps in the new default wording if it was untouched', () => {
    const next = applyTemplate(blankConfig('reference'), getTemplate('modern'))
    expect(next.body).toBe(getTemplate('modern').defaults.body)
  })
})
