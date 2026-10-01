import { resolveFont } from '../fonts/registry.js'
import type { Paragraph, Run } from '../text/richText.js'
import type { TextAlign } from '../../types/certificate.js'
import type { TextPrim } from './displayList.js'
import { measure, shape, type FontSet } from './measure.js'

export interface TextStyle {
  family: string
  size: number
  /** Line height as a multiple of the font size. */
  lineHeight: number
  align: TextAlign
  color: string
  /** Colour used for bold runs (e.g. the participant's name). */
  emphasisColor?: string
  /** Extra tracking in em (applied per character). */
  letterSpacing?: number
  /** Style for `# display` paragraphs. */
  display?: { family: string; scale: number; color: string; bold?: boolean }
}

export interface TextBlock {
  prims: TextPrim[]
  height: number
  lineCount: number
  /** Width of the widest line. */
  maxLineWidth: number
  /** True if a single word was wider than the box and had to be broken. */
  brokeWord: boolean
}

interface Seg {
  text: string
  font: string
  size: number
  rise: number
  color: string
  width: number
}

interface Word {
  segs: Seg[]
  width: number
  /** Width of the space that follows this word (0 at end of paragraph). */
  spaceAfter: number
}

const SUP_SCALE = 0.62
const SUP_RISE = 0.38

/** Width of a run of text including tracking (letter spacing in em). */
function textWidth(fonts: FontSet, font: string, text: string, size: number, letterSpacing: number): number {
  return measure(fonts, font, text, size) + letterSpacing * size * [...text].length
}

function segFor(fonts: FontSet, run: Run, text: string, style: TextStyle, family: string, size: number, color: string, forceBold = false): Seg {
  const font = resolveFont(family, run.bold || forceBold, run.italic)
  const segSize = run.sup ? size * SUP_SCALE : size
  const width = textWidth(fonts, font, text, segSize, style.letterSpacing ?? 0)
  const segColor = run.bold && style.emphasisColor ? style.emphasisColor : color
  return { text, font, size: segSize, rise: run.sup ? size * SUP_RISE : 0, color: segColor, width }
}

/** Split paragraph runs into words (a word can span several styled runs, e.g. 24^{th}). */
function toWords(fonts: FontSet, runs: Run[], style: TextStyle, family: string, size: number, color: string, forceBold: boolean): Word[] {
  const words: Word[] = []
  let cur: Word = { segs: [], width: 0, spaceAfter: 0 }
  for (const run of runs) {
    const parts = run.text.split(/( )/)
    for (const part of parts) {
      if (part === '') continue
      if (part === ' ') {
        if (cur.segs.length) {
          const space = segFor(fonts, { ...run, sup: false }, ' ', style, family, size, color, forceBold)
          cur.spaceAfter = space.width
          words.push(cur)
          cur = { segs: [], width: 0, spaceAfter: 0 }
        }
        continue
      }
      const seg = segFor(fonts, run, part, style, family, size, color, forceBold)
      cur.segs.push(seg)
      cur.width += seg.width
    }
  }
  if (cur.segs.length) words.push(cur)
  if (words.length) words[words.length - 1].spaceAfter = 0
  return words
}

/** Break a word that is wider than the line into pieces that fit. */
function breakWord(fonts: FontSet, word: Word, maxWidth: number, style: TextStyle): Word[] {
  const ls = style.letterSpacing ?? 0
  const pieces: Word[] = []
  let cur: Word = { segs: [], width: 0, spaceAfter: 0 }
  const flush = (seg: Seg, text: string) => {
    const w = textWidth(fonts, seg.font, text, seg.size, ls)
    cur.segs.push({ ...seg, text, width: w })
    cur.width += w
  }
  for (const seg of word.segs) {
    let buf = ''
    for (const ch of seg.text) {
      const w = textWidth(fonts, seg.font, buf + ch, seg.size, ls)
      if (cur.width + w > maxWidth && (buf || cur.segs.length)) {
        if (buf) flush(seg, buf)
        pieces.push(cur)
        cur = { segs: [], width: 0, spaceAfter: 0 }
        buf = ch
      } else buf += ch
    }
    if (buf) flush(seg, buf)
  }
  if (cur.segs.length) pieces.push(cur)
  pieces[pieces.length - 1].spaceAfter = word.spaceAfter
  return pieces
}

/** Emit a segment with an explicit x for every character (kerning + tracking included). */
function emitSeg(fonts: FontSet, prims: TextPrim[], seg: Seg, x: number, baseline: number, letterSpacing: number): void {
  const { xs } = shape(fonts, seg.font, seg.text)
  const ls = letterSpacing * seg.size
  prims.push({
    kind: 'text',
    x,
    y: baseline - seg.rise,
    text: seg.text,
    xs: xs.map((ox, i) => x + ox * seg.size + i * ls),
    font: seg.font,
    size: seg.size,
    color: seg.color,
  })
}

/**
 * Lay out paragraphs inside a box of the given width, starting at (x, top).
 * Greedy line breaking; justified lines stretch inter-word gaps, the last line
 * of a paragraph is set ragged (like LaTeX).
 */
export function layoutParagraphs(
  fonts: FontSet,
  paragraphs: Paragraph[],
  style: TextStyle,
  x: number,
  top: number,
  width: number,
): TextBlock {
  const prims: TextPrim[] = []
  let y = top
  let lineCount = 0
  let maxLineWidth = 0
  let brokeWord = false

  paragraphs.forEach((para, pi) => {
    if (para.blank) {
      y += style.size * style.lineHeight * 0.5
      return
    }
    const isDisplay = para.display && style.display
    const family = isDisplay ? style.display!.family : style.family
    const size = isDisplay ? style.size * style.display!.scale : style.size
    const color = isDisplay ? style.display!.color : style.color
    const lh = isDisplay ? size * 1.3 : size * style.lineHeight
    const align: TextAlign = isDisplay ? 'center' : style.align

    let words = toWords(fonts, para.runs, style, family, size, color, Boolean(isDisplay && style.display!.bold))
    if (words.some((w) => w.width > width)) {
      brokeWord = true
      words = words.flatMap((w) => (w.width > width ? breakWord(fonts, w, width, style) : [w]))
    }

    // Greedy line fill.
    const lines: Word[][] = []
    let line: Word[] = []
    let lineW = 0
    for (const w of words) {
      const prevSpace = line.length ? line[line.length - 1].spaceAfter : 0
      if (line.length && lineW + prevSpace + w.width > width + 0.01) {
        lines.push(line)
        line = [w]
        lineW = w.width
      } else {
        lineW += prevSpace + w.width
        line.push(w)
      }
    }
    if (line.length) lines.push(line)

    if (isDisplay && pi > 0) y += size * 0.15
    lines.forEach((ln, li) => {
      const natural = ln.reduce((s, w, i) => s + w.width + (i < ln.length - 1 ? w.spaceAfter : 0), 0)
      maxLineWidth = Math.max(maxLineWidth, natural)
      const last = li === lines.length - 1
      let extra = 0
      let startX = x
      if (align === 'justify' && !last && ln.length > 1) extra = (width - natural) / (ln.length - 1)
      else if (align === 'center') startX = x + (width - natural) / 2
      const baseline = y + lh / 2 + size * 0.32
      let cx = startX
      ln.forEach((w, wi) => {
        let sx = cx
        for (const seg of w.segs) {
          emitSeg(fonts, prims, seg, sx, baseline, style.letterSpacing ?? 0)
          sx += seg.width
        }
        cx += w.width + (wi < ln.length - 1 ? w.spaceAfter + extra : 0)
      })
      y += lh
      lineCount += 1
    })
    if (isDisplay) y += size * 0.15
    else if (pi < paragraphs.length - 1 && !paragraphs[pi + 1].blank) y += size * style.lineHeight * 0.15
  })

  return { prims, height: y - top, lineCount, maxLineWidth, brokeWord }
}

export interface FitOptions {
  maxHeight?: number
  maxLines?: number
  minSize: number
  step?: number
}

export interface FitResult extends TextBlock {
  size: number
  shrunk: boolean
  overflow: boolean
}

/**
 * Lay out text, shrinking the font size (down to `minSize`) until it fits the
 * box height / line limit. Keeps the template structure intact for long input.
 */
export function fitParagraphs(
  fonts: FontSet,
  paragraphs: Paragraph[],
  style: TextStyle,
  x: number,
  top: number,
  width: number,
  opts: FitOptions,
): FitResult {
  const step = opts.step ?? 0.25
  let size = style.size
  const fits = (b: TextBlock) =>
    (opts.maxHeight === undefined || b.height <= opts.maxHeight + 0.01) &&
    (opts.maxLines === undefined || b.lineCount <= opts.maxLines) &&
    !b.brokeWord
  let block = layoutParagraphs(fonts, paragraphs, { ...style, size }, x, top, width)
  while (!fits(block) && size - step >= opts.minSize - 1e-6) {
    size -= step
    block = layoutParagraphs(fonts, paragraphs, { ...style, size }, x, top, width)
  }
  return { ...block, size, shrunk: size < style.size, overflow: !fits(block) }
}

/** Convenience: single plain line of text as a paragraph. */
export function plainParagraph(text: string, bold = false, italic = false): Paragraph[] {
  const t = text.trim()
  return t ? [{ display: false, blank: false, runs: [{ text: t, bold, italic, sup: false }] }] : []
}
