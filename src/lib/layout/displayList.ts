import type { FontKey } from '../fonts/registry.js'

/**
 * The display list is the single source of truth for what a certificate looks
 * like. All coordinates are in PDF points (1/72 inch) with the origin at the
 * top-left of the page. The SVG preview, the PDF and the PNG are all produced
 * by walking this list, so they cannot drift apart.
 */

export interface TextPrim {
  kind: 'text'
  x: number
  /** Baseline y. */
  y: number
  text: string
  /** Absolute x of every character (code point). Renderers place each glyph here. */
  xs: number[]
  font: FontKey
  size: number
  color: string
}

export interface RectPrim {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
}

export interface LinePrim {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
}

/** An SVG path (y-down) drawn at (x, y) with the given scale. */
export interface PathPrim {
  kind: 'path'
  d: string
  x: number
  y: number
  scale: number
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export interface ImagePrim {
  kind: 'image'
  assetId: string
  src: string
  mime: 'image/png' | 'image/jpeg'
  x: number
  y: number
  w: number
  h: number
  opacity?: number
  alt: string
}

export type Prim = TextPrim | RectPrim | LinePrim | PathPrim | ImagePrim

export interface PageSize {
  width: number
  height: number
}

export interface CertificateLayout {
  page: PageSize
  prims: Prim[]
  /** Non-fatal layout problems, e.g. text had to be shrunk or still overflows. */
  warnings: string[]
  /** Font keys referenced by text prims (for PDF embedding). */
  fonts: FontKey[]
}

export const A4_LANDSCAPE: PageSize = { width: 841.89, height: 595.28 }
export const A4_PORTRAIT: PageSize = { width: 595.28, height: 841.89 }
