import type { LoadedFont } from '../fonts/loader'
import type { FontKey } from '../fonts/registry'

export type FontSet = Map<FontKey, LoadedFont>

export interface Shaped {
  /** Total advance in em, including kerning. */
  width: number
  /** Offset (em) of every character (code point) from the start of the text. */
  xs: number[]
}

interface FontMetricsCache {
  adv: Map<number, number>
  kern: Map<string, number>
  shaped: Map<string, Shaped>
}

const caches = new Map<FontKey, FontMetricsCache>()

function cacheFor(key: FontKey): FontMetricsCache {
  let c = caches.get(key)
  if (!c) {
    c = { adv: new Map(), kern: new Map(), shaped: new Map() }
    caches.set(key, c)
  }
  return c
}

function fontOf(fonts: FontSet, key: FontKey): LoadedFont {
  const f = fonts.get(key)
  if (!f) throw new Error(`Font not loaded: ${key}`)
  return f
}

function advance(f: LoadedFont, c: FontMetricsCache, cp: number): number {
  let a = c.adv.get(cp)
  if (a === undefined) {
    a = f.font.glyphForCodePoint(cp).advanceWidth / f.unitsPerEm
    c.adv.set(cp, a)
  }
  return a
}

/** Pair kerning (em) between two characters, as the font's GPOS/kern table defines it. */
function kerning(f: LoadedFont, c: FontMetricsCache, a: string, b: string): number {
  const pair = a + b
  let k = c.kern.get(pair)
  if (k === undefined) {
    k = 0
    const run = f.font.layout(pair)
    // Only a plain two-glyph result is a kern pair (ligatures are not used).
    if (run.glyphs.length === 2) k = (run.positions[0].xAdvance - run.glyphs[0].advanceWidth) / f.unitsPerEm
    c.kern.set(pair, k)
  }
  return k
}

/**
 * Position every character of `text` explicitly: glyph advance plus pair
 * kerning, no ligatures or contextual substitutions. Renderers draw each
 * character at exactly these offsets, so the SVG preview, the PDF (pdf-lib
 * cannot kern) and the PNG are identical to the point.
 */
export function shape(fonts: FontSet, key: FontKey, text: string): Shaped {
  const c = cacheFor(key)
  const hit = c.shaped.get(text)
  if (hit) return hit
  const f = fontOf(fonts, key)
  const chars = [...text]
  const xs: number[] = []
  let x = 0
  chars.forEach((ch, i) => {
    xs.push(x)
    x += advance(f, c, ch.codePointAt(0)!)
    if (i < chars.length - 1) x += kerning(f, c, ch, chars[i + 1])
  })
  const shaped = { width: x, xs }
  if (c.shaped.size > 5000) c.shaped.clear()
  c.shaped.set(text, shaped)
  return shaped
}

export function measure(fonts: FontSet, key: FontKey, text: string, size: number): number {
  return shape(fonts, key, text).width * size
}

/** Characters in `text` that the font has no glyph for. */
export function missingGlyphs(fonts: FontSet, key: FontKey, text: string): string[] {
  const f = fonts.get(key)
  if (!f) return []
  const missing = new Set<string>()
  for (const ch of text) {
    if (/\s/.test(ch)) continue
    if (!f.font.hasGlyphForCodePoint(ch.codePointAt(0)!)) missing.add(ch)
  }
  return [...missing]
}
