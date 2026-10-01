import { parseFont, type LoadedFont } from './core.js'
import type { FontKey } from './registry.js'

export type { LoadedFont } from './core.js'

/** Browser-only: URL of a bundled font file (served from /public/fonts). */
function fontUrl(key: FontKey): string {
  return `${import.meta.env.BASE_URL}fonts/${key}`
}

const cache = new Map<FontKey, Promise<LoadedFont>>()

/**
 * Browser font loading: fetch the TTF, parse it with fontkit (for measurement
 * and PDF embedding) and register it with the browser (for SVG preview and
 * canvas). The server equivalent lives in api/_lib/fonts.ts.
 */
export function loadFont(key: FontKey): Promise<LoadedFont> {
  let p = cache.get(key)
  if (!p) {
    p = (async () => {
      const res = await fetch(fontUrl(key))
      if (!res.ok) throw new Error(`Could not load font ${key} (${res.status})`)
      const loaded = parseFont(key, await res.arrayBuffer())
      const face = new FontFace(loaded.cssFamily, loaded.bytes.slice(0))
      await face.load()
      document.fonts.add(face)
      return loaded
    })()
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export async function loadFonts(keys: Iterable<FontKey>): Promise<Map<FontKey, LoadedFont>> {
  const unique = [...new Set(keys)]
  const loaded = await Promise.all(unique.map(loadFont))
  return new Map(loaded.map((f) => [f.key, f]))
}
