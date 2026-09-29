import { cssFamilyFor } from '../fonts/registry'
import type { CertificateLayout } from '../layout/displayList'
import { loadImage } from '../../utils/image'

/**
 * Rasterise the display list at a given DPI. This renders the certificate
 * itself at a defined resolution — it is not a screenshot of the viewport.
 */
export async function renderCanvas(layout: CertificateLayout, dpi: number): Promise<HTMLCanvasElement> {
  const scale = dpi / 72
  const { width: W, height: H } = layout.page
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'
  if ('fontKerning' in ctx) ctx.fontKerning = 'none'

  // Decode images up front so drawing is synchronous and ordered.
  const imgs = new Map<string, HTMLImageElement>()
  await Promise.all(
    layout.prims.map(async (p) => {
      if (p.kind === 'image' && !imgs.has(p.assetId)) imgs.set(p.assetId, await loadImage(p.src))
    }),
  )
  await document.fonts.ready

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
        const path = new Path2D(p.d)
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
      case 'image':
        if (p.opacity !== undefined) ctx.globalAlpha = p.opacity
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(imgs.get(p.assetId)!, p.x, p.y, p.w, p.h)
        break
      case 'text':
        ctx.font = `${p.size}px "${cssFamilyFor(p.font)}"`
        ctx.fillStyle = p.color
        ;[...p.text].forEach((ch, i) => ctx.fillText(ch, p.xs[i], p.y))
        break
    }
    ctx.restore()
  }
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))), type, quality),
  )
}
