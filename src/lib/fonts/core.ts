import { fontkit, type FontkitFont } from './fontkit.js'
import { cssFamilyFor, type FontKey } from './registry.js'

/**
 * A parsed font face, shared by every platform. The browser and the server
 * only differ in how they obtain the bytes (fetch vs. filesystem) and in
 * whether the face is also registered for on-screen drawing.
 */
export interface LoadedFont {
  key: FontKey
  /** The original TTF bytes (embedded into PDFs). */
  bytes: ArrayBuffer
  /** fontkit instance used for measuring text. */
  font: FontkitFont
  unitsPerEm: number
  /** Ascender / descender as a fraction of the em. */
  ascent: number
  descent: number
  /** Family name under which drawing surfaces (CSS FontFace, canvas) know this face. */
  cssFamily: string
}

export function parseFont(key: FontKey, bytes: ArrayBuffer): LoadedFont {
  const font = fontkit.create(new Uint8Array(bytes))
  return {
    key,
    bytes,
    font,
    unitsPerEm: font.unitsPerEm,
    ascent: font.ascent / font.unitsPerEm,
    descent: Math.abs(font.descent) / font.unitsPerEm,
    cssFamily: cssFamilyFor(key),
  }
}
