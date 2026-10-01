import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { FieldError } from '../../src/lib/api/errors.js'
import { API_LIMITS } from '../../src/lib/api/limits.js'
import { expectedPngDataSize, isWellFormedJpeg, parsePngStructure, readDimensions, sniffFormat } from '../../src/lib/imageFormat.js'
import type { ImageAsset } from '../../src/types/certificate.js'

async function webpToPng(bytes: Uint8Array, field: string): Promise<Uint8Array> {
  try {
    // Loaded lazily: the native canvas module is only needed for WebP input
    // (and the PNG endpoint), never for ordinary PDF generation.
    const { createCanvas, loadImage } = await import('@napi-rs/canvas')
    const img = await loadImage(Buffer.from(bytes))
    const canvas = createCanvas(img.width, img.height)
    canvas.getContext('2d').drawImage(img, 0, 0)
    return new Uint8Array(await canvas.encode('png'))
  } catch {
    throw new FieldError(field, `${field} is not a readable WebP image`)
  }
}

/**
 * Prove a PNG is complete and consistent before pdf-lib decodes it (its
 * decoder hangs on truncated files): every chunk/CRC must check out and the
 * image data must inflate to exactly the size the header implies.
 */
function assertSafePng(bytes: Uint8Array, field: string): void {
  const png = parsePngStructure(bytes)
  const expected = png && expectedPngDataSize(png)
  if (!png || !expected) throw new FieldError(field, `${field} is not a complete, valid PNG file`)
  let size: number
  try {
    size = inflateSync(Buffer.concat(png.idat), { maxOutputLength: expected + 1 }).length
  } catch {
    throw new FieldError(field, `${field} is not a complete, valid PNG file (corrupt image data)`)
  }
  if (size !== expected) throw new FieldError(field, `${field} is not a complete, valid PNG file (image data size mismatch)`)
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Decode an image supplied in an API request — a `data:image/...;base64,...`
 * URL (or bare base64, or `{ "dataUrl": ... }`) — into a validated
 * ImageAsset. PNG and JPEG are used as-is after structural validation, WebP
 * is converted to PNG because PDFs cannot embed WebP. Rejects malformed
 * base64, unsupported formats, truncated files, oversized files and images
 * with absurd dimensions.
 */
export async function decodeImageInput(value: unknown, field: string): Promise<ImageAsset | null> {
  if (value === undefined || value === null || value === '') return null
  let input: unknown = value
  if (typeof input === 'object' && !Array.isArray(input)) input = (input as Record<string, unknown>).dataUrl
  if (typeof input !== 'string') throw new FieldError(field, `${field} must be a data URL string such as "data:image/png;base64,..."`)

  let b64 = input
  const m = /^data:([^;,]*)((?:;[^;,]*)*),/i.exec(input)
  if (m) {
    if (!/;base64/i.test(m[2])) throw new FieldError(field, `${field} must be base64-encoded (data:image/png;base64,...)`)
    if (m[1] && !/^image\/(png|jpe?g|webp)$/i.test(m[1]))
      throw new FieldError(field, `${field} has unsupported type "${m[1]}". Use PNG, JPEG or WebP.`)
    b64 = input.slice(m[0].length)
  } else if (input.startsWith('data:')) {
    throw new FieldError(field, `${field} is not a valid data URL`)
  }
  b64 = b64.replace(/\s+/g, '')

  if ((b64.length * 3) / 4 > API_LIMITS.maxImageBytes * 1.01)
    throw new FieldError(field, `${field} is larger than ${API_LIMITS.maxImageBytes / 1048576} MB`, 413)
  if (!b64 || b64.length % 4 !== 0 || !BASE64.test(b64)) throw new FieldError(field, `${field} contains malformed base64 data`)

  let bytes: Uint8Array = Buffer.from(b64, 'base64')
  const format = sniffFormat(bytes)
  if (format === 'gif' || format === 'svg')
    throw new FieldError(field, `${field} is ${format.toUpperCase()}, which is not supported. Use PNG, JPEG or WebP.`)
  if (!format) throw new FieldError(field, `${field} is not a PNG, JPEG or WebP image`)

  const dims = readDimensions(bytes, format)
  if (!dims || !dims.width || !dims.height) throw new FieldError(field, `${field} could not be read (corrupt ${format.toUpperCase()} header)`)
  if (dims.width * dims.height > API_LIMITS.maxImagePixels)
    throw new FieldError(field, `${field} is ${dims.width}×${dims.height} px; the maximum is ${API_LIMITS.maxImagePixels / 1e6} megapixels`, 413)

  const mime: ImageAsset['mime'] = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  if (format === 'webp') bytes = await webpToPng(bytes, field)
  if (mime === 'image/png') assertSafePng(bytes, field)
  else if (!isWellFormedJpeg(bytes)) throw new FieldError(field, `${field} is not a complete, valid JPEG file`)

  // Final check that the PDF writer accepts it (unsupported PNG variants etc.).
  let width: number
  let height: number
  try {
    const probe = await PDFDocument.create()
    const img = mime === 'image/jpeg' ? await probe.embedJpg(bytes) : await probe.embedPng(bytes)
    width = img.width
    height = img.height
  } catch {
    throw new FieldError(field, `${field} could not be decoded as ${mime}`)
  }

  return {
    // Content hash: identical images (e.g. a shared logo in a batch) are embedded once.
    id: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
    mime,
    width,
    height,
    name: field,
    alt: '',
  }
}
