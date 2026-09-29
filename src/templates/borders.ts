import type { PageSize, Prim } from '../lib/layout/displayList'
import type { BorderStyle } from '../types/certificate'

export const BORDER_STYLES: Array<{ id: BorderStyle; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'single', label: 'Single line' },
  { id: 'double', label: 'Double line' },
  { id: 'thick-thin', label: 'Thick & thin' },
  { id: 'ornate', label: 'Ornate corners' },
]

const rectStroke = (x: number, y: number, w: number, h: number, color: string, width: number): Prim => ({
  kind: 'rect',
  x: x + width / 2,
  y: y + width / 2,
  w: w - width,
  h: h - width,
  stroke: color,
  strokeWidth: width,
})

/**
 * Corner flourish drawn in a 1×1 unit box (y-down), for the top-left corner.
 * Other corners are produced by mirroring the path coordinates.
 */
function cornerFlourish(size: number): string {
  const s = size
  const p = (x: number, y: number) => `${(x * s).toFixed(2)} ${(y * s).toFixed(2)}`
  return [
    // diamond at the corner
    `M${p(0, 0.16)} L${p(0.16, 0)} L${p(0.32, 0.16)} L${p(0.16, 0.32)} Z`,
    // scroll along the top edge
    `M${p(0.36, 0.1)} C${p(0.55, 0.02)} ${p(0.72, 0.2)} ${p(0.58, 0.28)} C${p(0.5, 0.33)} ${p(0.44, 0.24)} ${p(0.5, 0.2)} C${p(0.54, 0.17)} ${p(0.6, 0.2)} ${p(0.57, 0.24)} C${p(0.62, 0.16)} ${p(0.5, 0.1)} ${p(0.4, 0.14)} Z`,
    // scroll along the left edge (mirror of above across the diagonal)
    `M${p(0.1, 0.36)} C${p(0.02, 0.55)} ${p(0.2, 0.72)} ${p(0.28, 0.58)} C${p(0.33, 0.5)} ${p(0.24, 0.44)} ${p(0.2, 0.5)} C${p(0.17, 0.54)} ${p(0.2, 0.6)} ${p(0.24, 0.57)} C${p(0.16, 0.62)} ${p(0.1, 0.5)} ${p(0.14, 0.4)} Z`,
    // small dot
    `M${p(0.4, 0.4)} m${-0.035 * s} 0 a${0.035 * s} ${0.035 * s} 0 1 0 ${0.07 * s} 0 a${0.035 * s} ${0.035 * s} 0 1 0 ${-0.07 * s} 0 Z`,
  ].join(' ')
}

/** Mirror an absolute-coordinate path built by cornerFlourish into another corner. */
function mirrorPath(d: string, flipX: boolean, flipY: boolean, size: number): string {
  // Only absolute M/L/C commands use coordinate pairs; the dot uses relative
  // m/a commands, which we transform separately.
  return d.replace(/([MLC])([^MLCZmaz]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const out: string[] = []
    for (let i = 0; i < nums.length; i += 2) {
      const x = flipX ? size - nums[i] : nums[i]
      const y = flipY ? size - nums[i + 1] : nums[i + 1]
      out.push(`${x.toFixed(2)} ${y.toFixed(2)}`)
    }
    return `${cmd}${out.join(' ')} `
  })
}

export function borderPrims(page: PageSize, style: BorderStyle, color: string, width: number, inset: number): Prim[] {
  const { width: W, height: H } = page
  const x = inset
  const y = inset
  const w = W - inset * 2
  const h = H - inset * 2
  const bw = Math.max(0.25, width)
  switch (style) {
    case 'none':
      return []
    case 'single':
      return [rectStroke(x, y, w, h, color, bw)]
    case 'double': {
      const gap = Math.max(3, bw * 2.2)
      return [rectStroke(x, y, w, h, color, bw), rectStroke(x + bw + gap, y + bw + gap, w - 2 * (bw + gap), h - 2 * (bw + gap), color, bw)]
    }
    case 'thick-thin': {
      const thick = bw * 2.5
      const gap = Math.max(3, bw * 2)
      const thin = Math.max(0.4, bw * 0.5)
      return [
        rectStroke(x, y, w, h, color, thick),
        rectStroke(x + thick + gap, y + thick + gap, w - 2 * (thick + gap), h - 2 * (thick + gap), color, thin),
      ]
    }
    case 'ornate': {
      const thin = Math.max(0.4, bw * 0.5)
      const gap = Math.max(4, bw * 2.5)
      const inner = bw + gap
      const size = 46
      const d = cornerFlourish(size)
      const prims: Prim[] = [
        rectStroke(x, y, w, h, color, bw),
        rectStroke(x + inner, y + inner, w - 2 * inner, h - 2 * inner, color, thin),
      ]
      const off = inner + thin + 3
      const corners: Array<[number, number, boolean, boolean]> = [
        [x + off, y + off, false, false],
        [x + w - off - size, y + off, true, false],
        [x + off, y + h - off - size, false, true],
        [x + w - off - size, y + h - off - size, true, true],
      ]
      for (const [cx, cy, fx, fy] of corners) {
        // The small dot uses relative commands; recompute it for mirrored corners.
        const base = d.slice(0, d.lastIndexOf('M'))
        const dotC = [0.4 * size, 0.4 * size]
        const dx = fx ? size - dotC[0] : dotC[0]
        const dy = fy ? size - dotC[1] : dotC[1]
        const r = 0.035 * size
        const dot = `M${(dx - r).toFixed(2)} ${dy.toFixed(2)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
        prims.push({ kind: 'path', d: mirrorPath(base, fx, fy, size) + dot, x: cx, y: cy, scale: 1, fill: color })
      }
      return prims
    }
  }
}
