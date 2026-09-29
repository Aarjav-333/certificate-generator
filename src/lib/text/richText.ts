/**
 * Minimal rich-text markup used in the certificate wording:
 *
 *   *italic*   **bold**   ***bold italic***   ^{superscript}
 *   # Display line   (a whole line, e.g. the participant's name in a script font)
 *   \*  \^  \#  \\   literal characters
 *
 * A blank line inserts extra vertical space; a single newline starts a new line.
 */

export interface RunStyle {
  bold: boolean
  italic: boolean
  sup: boolean
}

export interface Run extends RunStyle {
  text: string
}

export interface Paragraph {
  display: boolean
  runs: Run[]
  /** Empty paragraph (blank line) used as spacing. */
  blank: boolean
}

interface StyledChar extends RunStyle {
  ch: string
}

function parseInline(src: string): StyledChar[] {
  const out: StyledChar[] = []
  let bold = false
  let italic = false
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '\\' && i + 1 < src.length) {
      out.push({ ch: src[i + 1], bold, italic, sup: false })
      i += 2
      continue
    }
    if (c === '*') {
      if (src.startsWith('***', i)) {
        bold = !bold
        italic = !italic
        i += 3
      } else if (src.startsWith('**', i)) {
        bold = !bold
        i += 2
      } else {
        italic = !italic
        i += 1
      }
      continue
    }
    if (c === '^' && src[i + 1] === '{') {
      const close = src.indexOf('}', i + 2)
      if (close > -1) {
        const inner = src.slice(i + 2, close).replace(/\\(.)/g, '$1')
        for (const ch of inner) out.push({ ch, bold, italic, sup: true })
        i = close + 1
        continue
      }
    }
    out.push({ ch: c, bold, italic, sup: false })
    i += 1
  }
  return out
}

const PUNCT_NO_SPACE_BEFORE = /[,.;:!?)\]”’]/

/** Collapse runs of whitespace and remove stray spaces around punctuation — */
/* needed when optional variables are empty ("Name, , Dept" → "Name, Dept"). */
function tidy(chars: StyledChar[]): StyledChar[] {
  const out: StyledChar[] = []
  for (const sc of chars) {
    const isSpace = /\s/.test(sc.ch)
    const c: StyledChar = isSpace ? { ...sc, ch: ' ' } : sc
    const prev = out[out.length - 1]
    if (isSpace) {
      if (!prev || prev.ch === ' ' || prev.ch === '(' || prev.ch === '“') continue
      out.push(c)
      continue
    }
    if (PUNCT_NO_SPACE_BEFORE.test(c.ch)) {
      while (out.length && out[out.length - 1].ch === ' ') out.pop()
      // ", ," → ","
      const last = out[out.length - 1]
      if (last && c.ch === ',' && last.ch === ',') continue
      if (last && c.ch === '.' && last.ch === ',') out.pop()
    }
    if (c.ch === ',' && out.length === 0) continue
    out.push(c)
  }
  while (out.length && out[out.length - 1].ch === ' ') out.pop()
  return out
}

function toRuns(chars: StyledChar[]): Run[] {
  const runs: Run[] = []
  for (const c of chars) {
    const last = runs[runs.length - 1]
    if (last && last.bold === c.bold && last.italic === c.italic && last.sup === c.sup) last.text += c.ch
    else runs.push({ text: c.ch, bold: c.bold, italic: c.italic, sup: c.sup })
  }
  return runs
}

export function parseRichText(src: string): Paragraph[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const paras: Paragraph[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      // Collapse consecutive blank lines, and ignore leading ones.
      if (paras.length && !paras[paras.length - 1].blank) paras.push({ display: false, runs: [], blank: true })
      continue
    }
    const display = /^#\s/.test(trimmed)
    const runs = toRuns(tidy(parseInline(display ? trimmed.replace(/^#\s+/, '') : trimmed)))
    // A line whose variables were all empty is dropped entirely.
    if (!runs.length) continue
    paras.push({ display, runs, blank: false })
  }
  while (paras.length && paras[paras.length - 1].blank) paras.pop()
  return paras
}

/** Plain-text version (used for short single-line fields). */
export function plainText(src: string): string {
  return parseRichText(src)
    .map((p) => p.runs.map((r) => r.text).join(''))
    .join(' ')
}
