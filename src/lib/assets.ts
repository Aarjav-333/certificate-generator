import type { ImageAsset } from '../types/certificate.js'
import { dataUrlToBytes } from '../utils/dataUrl.js'
import { isWellFormedJpeg, parsePngStructure } from './imageFormat.js'

/**
 * Check for images coming from imported JSON, storage or the API: the right
 * shape, and a structurally complete PNG/JPEG (a truncated PNG would hang the
 * PDF writer).
 */
export function isValidAsset(a: unknown): a is ImageAsset {
  if (!a || typeof a !== 'object') return false
  const x = a as Record<string, unknown>
  const shapeOk =
    typeof x.dataUrl === 'string' &&
    /^data:image\/(png|jpeg);base64,/.test(x.dataUrl) &&
    (x.mime === 'image/png' || x.mime === 'image/jpeg') &&
    typeof x.width === 'number' &&
    typeof x.height === 'number' &&
    x.width > 0 &&
    x.height > 0
  if (!shapeOk) return false
  try {
    const bytes = dataUrlToBytes(x.dataUrl as string)
    return x.mime === 'image/png' ? parsePngStructure(bytes) !== null : isWellFormedJpeg(bytes)
  } catch {
    return false
  }
}
