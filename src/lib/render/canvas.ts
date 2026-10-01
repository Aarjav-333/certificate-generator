import type { CertificateLayout } from '../layout/displayList.js'
import { loadImage } from '../../utils/image.js'
import { drawLayout, type DrawContext } from './draw.js'

/**
 * Browser rasteriser: draws the display list at a given DPI. This renders the
 * certificate itself at a defined resolution — it is not a screenshot.
 */
export async function renderCanvas(layout: CertificateLayout, dpi: number): Promise<HTMLCanvasElement> {
  const scale = dpi / 72
  const { width: W, height: H } = layout.page
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not supported in this browser.')
  if ('fontKerning' in ctx) ctx.fontKerning = 'none'

  // Decode images up front so drawing is synchronous and ordered.
  const images = new Map<string, HTMLImageElement>()
  await Promise.all(
    layout.prims.map(async (p) => {
      if (p.kind === 'image' && !images.has(p.assetId)) images.set(p.assetId, await loadImage(p.src))
    }),
  )
  await document.fonts.ready

  drawLayout(ctx as unknown as DrawContext, layout, { scale, images, Path2D })
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))), type, quality),
  )
}
