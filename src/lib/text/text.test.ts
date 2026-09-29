import { describe, expect, it } from 'vitest'
import { checkTemplate, escapeMarkup, renderTemplate } from './placeholders'
import { parseRichText, plainText } from './richText'

const vars = {
  salutation: '',
  name: 'Aarjav Oravakandi',
  affiliation: '',
  event_name: 'Sample Event',
  organizer: 'Sample Org',
  venue: '',
}

describe('renderTemplate', () => {
  it('substitutes variables and filters', () => {
    expect(renderTemplate('Hi {{name}} / {{name|upper}} / {{ name | lower }}', vars)).toBe(
      'Hi Aarjav Oravakandi / AARJAV ORAVAKANDI / aarjav oravakandi',
    )
  })

  it('handles conditional sections', () => {
    const t = '{{event_name}}{{#organizer}}, organized by {{organizer}}{{/organizer}}{{#venue}}, at {{venue}}{{/venue}}{{^venue}} (online){{/venue}}.'
    expect(renderTemplate(t, vars)).toBe('Sample Event, organized by Sample Org (online).')
  })

  it('drops emphasis around empty variables so the rest is not bolded', () => {
    const t = 'certify that ***{{salutation}} {{name|upper}},*** *{{affiliation}}* has participated'
    const text = plainText(renderTemplate(t, vars))
    expect(text).toBe('certify that AARJAV ORAVAKANDI, has participated')
    const runs = parseRichText(renderTemplate(t, vars))[0].runs
    expect(runs.at(-1)).toMatchObject({ text: ' has participated', bold: false, italic: false })
  })

  it('never interprets markup inside user values', () => {
    const out = renderTemplate('**{{name}}**', { name: escapeMarkup('A *star* ^{x} # {{name}}') })
    const runs = parseRichText(out)[0].runs
    expect(runs).toEqual([{ text: 'A *star* ^{x} # {{name}}', bold: true, italic: false, sup: false }])
  })
})

describe('checkTemplate', () => {
  it('reports unknown variables and unbalanced sections', () => {
    const msgs = checkTemplate('{{nme}} {{#venue}} x {{name|shout}}').map((i) => i.message)
    expect(msgs.some((m) => m.includes('{{nme}}'))).toBe(true)
    expect(msgs.some((m) => m.includes('never closed'))).toBe(true)
    expect(msgs.some((m) => m.includes('|shout'))).toBe(true)
  })

  it('accepts the default wording', () => {
    expect(checkTemplate('This is {{name|upper}}{{#venue}}, at {{venue}}{{/venue}} {{date_range}}.')).toEqual([])
  })
})

describe('parseRichText', () => {
  it('parses bold, italic, bold-italic and superscript', () => {
    const [p] = parseRichText('a **b** *c* ***d*** 24^{th}')
    expect(p.runs).toEqual([
      { text: 'a ', bold: false, italic: false, sup: false },
      { text: 'b', bold: true, italic: false, sup: false },
      { text: ' ', bold: false, italic: false, sup: false },
      { text: 'c', bold: false, italic: true, sup: false },
      { text: ' ', bold: false, italic: false, sup: false },
      { text: 'd', bold: true, italic: true, sup: false },
      { text: ' 24', bold: false, italic: false, sup: false },
      { text: 'th', bold: false, italic: false, sup: true },
    ])
  })

  it('recognises display lines and blank-line spacing', () => {
    const paras = parseRichText('Presented to\n# Jane Doe\n\n\nfor work')
    expect(paras.map((p) => [p.display, p.blank])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [false, false],
    ])
  })

  it('tidies spaces and commas left by empty values', () => {
    expect(plainText('Name , ,  Dept ,and more .')).toBe('Name, Dept,and more.')
    expect(plainText('held at  , on 2026')).toBe('held at, on 2026')
  })

  it('drops lines that end up empty', () => {
    expect(parseRichText('a\n**  **\nb')).toHaveLength(2)
  })
})
