import { cssFamilyFor } from '../fonts/registry.js'
import type { CertificateLayout } from '../layout/displayList.js'

/**
 * The subset of the Canvas 2D API the certificate drawer needs. Both the
 * browser's CanvasRenderingContext2D and @napi-rs/canvas (server) satisfy it.
 */
export interface DrawContext {
  save(): void
  restore(): void
  scale(x: number, y: number): void
  translate(x: number, y: number): void
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(path?: unknown): void
  fill(path?: unknown): void
  fillText(text: string, x: number, y: number): void
  drawImage(image: never, x: number, y: number, w: number, h: number): void
  globalAlpha: number
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  font: string
  textBaseline: string
  imageSmoothingQuality: string
}

export interface DrawOptions {
  /** Pixels per PDF point (dpi / 72). */
  scale: number
  /** Decoded images keyed by asset id. */
  images: Map<string, unknown>
  /** Path2D constructor of the drawing platform. */
  Path2D: new (d: string) => unknown
}

/**
 * Draw a composed certificate onto a 2D context. Shared by the browser PNG/JPG
 * export and the server PNG endpoint, so both rasterise the identical display
 * list. Every character is drawn at its engine-computed x position.
 */
export function drawLayout(ctx: DrawContext, layout: CertificateLayout, opts: DrawOptions): void {
  ctx.scale(opts.scale, opts.scale)
  ctx.textBaseline = 'alphabetic'
  for (const p of layout.prims) {
    ctx.save()
    switch (p.kind) {
      case 'rect':
        if (p.opacity !== undefined) ctx.globalAlpha = p.opacity
        if (p.fill && p.fill !== 'none') {
          ctx.fillStyle = p.fill
          ctx.fillRect(p.x, p.y, p.w, p.h)
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke
          ctx.lineWidth = p.strokeWidth ?? 1
          ctx.strokeRect(p.x, p.y, p.w, p.h)
        }
        break
      case 'line':
        ctx.strokeStyle = p.color
        ctx.lineWidth = p.width
        ctx.beginPath()
        ctx.moveTo(p.x1, p.y1)
        ctx.lineTo(p.x2, p.y2)
        ctx.stroke()
        break
      case 'path': {
        ctx.translate(p.x, p.y)
        ctx.scale(p.scale, p.scale)
        const path = new opts.Path2D(p.d)
        if (p.fill) {
          ctx.fillStyle = p.fill
          ctx.fill(path)
        }
        if (p.stroke) {
          ctx.strokeStyle = p.stroke
          ctx.lineWidth = p.strokeWidth ?? 1
          ctx.stroke(path)
        }
        break
      }
      case 'image': {
        const img = opts.images.get(p.assetId)
        if (!img) break
        if (p.opacity !== undefined) ctx.globalAlpha = p.opacity
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img as never, p.x, p.y, p.w, p.h)
        break
      }
      case 'text':
        ctx.font = `${p.size}px "${cssFamilyFor(p.font)}"`
        ctx.fillStyle = p.color
        ;[...p.text].forEach((ch, i) => ctx.fillText(ch, p.xs[i], p.y))
        break
    }
    ctx.restore()
  }
}
