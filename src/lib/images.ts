import type { ImageAsset } from '../types/certificate.js'
import { newId } from '../utils/dataUrl.js'
import { blobToDataUrl, loadImage } from '../utils/image.js'

export type ImageKind = 'logo' | 'graphic' | 'signature' | 'background'

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
export const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml'
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

/** Longest side (px) we keep per image kind — plenty for 300 DPI print at the sizes used. */
const MAX_SIDE: Record<ImageKind, number> = {
  logo: 1400,
  graphic: 1600,
  signature: 1400,
  background: 3508,
}

export class ImageUploadError extends Error {}

function detectType(file: File): string | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase()
  return (
    { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml' } as Record<string, string>
  )[ext ?? ''] ?? null
}

export interface ProcessOptions {
  /** Turn a white/paper background transparent (useful for scanned signatures). */
  removeWhite?: boolean
  /** Crop transparent margins so size controls behave predictably. */
  trim?: boolean
}

/**
 * Validate an uploaded file and normalise it to PNG (keeps transparency) or
 * JPEG, downscaled to a sensible size. SVG and WebP are rasterised because the
 * PDF format only embeds PNG/JPEG images.
 */
export async function processImageFile(file: File, kind: ImageKind, opts: ProcessOptions = {}): Promise<ImageAsset> {
  const type = detectType(file)
  if (!type) throw new ImageUploadError(`"${file.name}" is not a supported image. Use PNG, JPG, WebP or SVG.`)
  if (file.size > MAX_UPLOAD_BYTES)
    throw new ImageUploadError(`"${file.name}" is ${(file.size / 1048576).toFixed(1)} MB — the limit is ${MAX_UPLOAD_BYTES / 1048576} MB.`)
  if (file.size === 0) throw new ImageUploadError(`"${file.name}" is empty.`)

  const src = await blobToDataUrl(type === 'image/svg+xml' ? new Blob([await file.text()], { type }) : file)
  let img: HTMLImageElement
  try {
    img = await loadImage(src)
  } catch {
    throw new ImageUploadError(`"${file.name}" could not be read. The file may be corrupt or not really a ${type.split('/')[1].toUpperCase()}.`)
  }

  let w = img.naturalWidth
  let h = img.naturalHeight
  if (type === 'image/svg+xml' && (!w || !h)) {
    // SVG without intrinsic size: fall back to its viewBox.
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(await file.text())
    w = vb ? parseFloat(vb[1]) : 1000
    h = vb ? parseFloat(vb[2]) : 1000
  }
  if (!w || !h) throw new ImageUploadError(`"${file.name}" has no dimensions.`)

  // SVGs are vector — rasterise them large; bitmaps are only ever scaled down.
  const maxSide = MAX_SIDE[kind]
  const scale = type === 'image/svg+xml' ? maxSide / Math.max(w, h) : Math.min(1, maxSide / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))

  // Photos stay JPEG (smaller); everything else becomes PNG to keep transparency.
  const keepJpeg = type === 'image/jpeg' && !opts.removeWhite
  // Use the original bytes untouched when no processing is needed.
  if (keepJpeg && scale === 1 && file.size < 3 * 1024 * 1024) {
    return { id: newId(), dataUrl: src, mime: 'image/jpeg', width: w, height: h, name: file.name, alt: '' }
  }
  if (type === 'image/png' && scale === 1 && !opts.removeWhite && !opts.trim) {
    return { id: newId(), dataUrl: src, mime: 'image/png', width: w, height: h, name: file.name, alt: '' }
  }

  let canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: Boolean(opts.removeWhite || opts.trim) })!
  if (keepJpeg) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, outW, outH)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, outW, outH)

  if (opts.removeWhite) whiteToTransparent(ctx, outW, outH)
  if (opts.trim && !keepJpeg) canvas = trimTransparent(canvas)

  const mime = keepJpeg ? 'image/jpeg' : 'image/png'
  const dataUrl = canvas.toDataURL(mime, 0.92)
  return { id: newId(), dataUrl, mime, width: canvas.width, height: canvas.height, name: file.name, alt: '' }
}

/** Make light paper pixels transparent with a soft ramp so ink edges stay smooth. */
function whiteToTransparent(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const hi = 225
  const lo = 150
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    if (lum >= hi) px[i + 3] = 0
    else if (lum > lo) px[i + 3] = Math.round(px[i + 3] * (1 - (lum - lo) / (hi - lo)))
  }
  ctx.putImageData(data, 0, 0)
}

function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const px = ctx.getImageData(0, 0, w, h).data
  let top = h
  let left = w
  let right = -1
  let bottom = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return canvas // fully transparent — leave as is
  const pad = 2
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(w - 1, right + pad)
  bottom = Math.min(h - 1, bottom + pad)
  if (left === 0 && top === 0 && right === w - 1 && bottom === h - 1) return canvas
  const out = document.createElement('canvas')
  out.width = right - left + 1
  out.height = bottom - top + 1
  out.getContext('2d')!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

/** Rasterise an inline SVG string (used for the built-in sample assets). */
export async function svgToAsset(svg: string, name: string, maxSide: number, alt: string): Promise<ImageAsset> {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const img = await loadImage(src)
  const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg)
  const w = vb ? parseFloat(vb[1]) : img.naturalWidth
  const h = vb ? parseFloat(vb[2]) : img.naturalHeight
  const scale = maxSide / Math.max(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { id: newId(), dataUrl: canvas.toDataURL('image/png'), mime: 'image/png', width: canvas.width, height: canvas.height, name, alt }
}
