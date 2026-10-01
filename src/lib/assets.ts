import type { ImageAsset } from '../types/certificate.js'

/** Basic structural check for images coming from imported JSON or storage. */
export function isValidAsset(a: unknown): a is ImageAsset {
  if (!a || typeof a !== 'object') return false
  const x = a as Record<string, unknown>
  return (
    typeof x.dataUrl === 'string' &&
    /^data:image\/(png|jpeg);base64,/.test(x.dataUrl) &&
    (x.mime === 'image/png' || x.mime === 'image/jpeg') &&
    typeof x.width === 'number' &&
    typeof x.height === 'number' &&
    x.width > 0 &&
    x.height > 0
  )
}
