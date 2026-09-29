import { fontkit, type FontkitFont } from './fontkit'
import { cssFamilyFor, fontUrl, type FontKey } from './registry'

export interface LoadedFont {
  key: FontKey
  bytes: ArrayBuffer
  font: FontkitFont
  unitsPerEm: number
  /** Ascender / descender as a fraction of the em. */
  ascent: number
  descent: number
  cssFamily: string
}

const cache = new Map<FontKey, Promise<LoadedFont>>()

/**
 * Load a font once: fetch the TTF, parse it with fontkit (for measurement and
 * PDF embedding) and register it with the browser (for SVG preview and canvas).
 */
export function loadFont(key: FontKey): Promise<LoadedFont> {
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const res = await fetch(fontUrl(key))
      if (!res.ok) throw new Error(`Could not load font ${key} (${res.status})`)
      const bytes = await res.arrayBuffer()
      const font = fontkit.create(new Uint8Array(bytes))
      const cssFamily = cssFamilyFor(key)
      const face = new FontFace(cssFamily, bytes.slice(0))
      await face.load()
      document.fonts.add(face)
      return {
        key,
        bytes,
        font,
        unitsPerEm: font.unitsPerEm,
        ascent: font.ascent / font.unitsPerEm,
        descent: Math.abs(font.descent) / font.unitsPerEm,
        cssFamily,
      }
    })()
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export async function loadFonts(
  keys: Iterable<FontKey>,
): Promise<Map<FontKey, LoadedFont>> {
  const unique = [...new Set(keys)]
  const loaded = await Promise.all(unique.map(loadFont))
  return new Map(loaded.map((f) => [f.key, f]))
}
