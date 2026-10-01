import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFont, type LoadedFont } from '../../src/lib/fonts/core.js'
import { FONT_FAMILIES, type FontKey } from '../../src/lib/fonts/registry.js'
import type { FontSet } from '../../src/lib/layout/measure.js'

/** Only files listed in the font registry can ever be read — no user-controlled paths. */
const KNOWN_FONTS = new Set(FONT_FAMILIES.flatMap((f) => f.variants.map((v) => v.file)))

let fontDir: string | null = null

/**
 * The bundled TTFs live in public/fonts. On Vercel they are copied into the
 * function bundle via `includeFiles` (vercel.json); locally they are read
 * from the project. Try the working directory first, then the path relative
 * to this module.
 */
function resolveFontDir(): string {
  if (fontDir) return fontDir
  const candidates = [path.join(process.cwd(), 'public', 'fonts'), fileURLToPath(new URL('../../public/fonts/', import.meta.url))]
  const found = candidates.find((d) => existsSync(path.join(d, 'cmu-serif-400-normal.ttf')))
  if (!found) throw new Error('Certificate fonts are missing from the deployment (public/fonts not bundled).')
  fontDir = found
  return found
}

// Parsed fonts are kept for the lifetime of the function instance and reused
// across requests (Fluid Compute reuses warm instances).
const cache = new Map<FontKey, Promise<LoadedFont>>()

export function loadServerFont(key: FontKey): Promise<LoadedFont> {
  if (!KNOWN_FONTS.has(key)) return Promise.reject(new Error(`Unknown font: ${key}`))
  let p = cache.get(key)
  if (!p) {
    p = readFile(path.join(resolveFontDir(), key)).then((buf) =>
      parseFont(key, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer),
    )
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export async function loadServerFonts(keys: Iterable<FontKey>): Promise<FontSet> {
  const loaded = await Promise.all([...new Set(keys)].map(loadServerFont))
  return new Map(loaded.map((f) => [f.key, f]))
}
