/**
 * Pure (platform-independent) inspection of PNG / JPEG / WebP files: format
 * sniffing, header dimensions and structural validation.
 *
 * Structural validation matters for safety: pdf-lib's PNG decoder loops
 * forever on a truncated PNG, and its JPEG embedder accepts truncated files
 * without complaint. Untrusted images must pass these checks before they
 * reach the PDF writer.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp'

const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end))

/** Identify the real format from the file signature (never trust the declared type alone). */
export function sniffFormat(b: Uint8Array): ImageFormat | 'gif' | 'svg' | null {
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (b.length >= 6 && ascii(b, 0, 4) === 'GIF8') return 'gif'
  const head = new TextDecoder().decode(b.subarray(0, 256)).trimStart()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg'
  return null
}

/**
 * Width/height from the header, without decoding pixels — so a tiny file that
 * claims 100 000 × 100 000 px can be rejected before it exhausts memory.
 */
export function readDimensions(b: Uint8Array, format: ImageFormat): { width: number; height: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  try {
    if (format === 'png') return b.length >= 24 && ascii(b, 12, 16) === 'IHDR' ? { width: dv.getUint32(16), height: dv.getUint32(20) } : null
    if (format === 'jpeg') {
      let i = 2
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null
        const marker = b[i + 1]
        if (marker === 0xff) {
          i++ // fill byte
          continue
        }
        if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          i += 2
          continue
        }
        // SOF0–SOF15 (except DHT C4, JPG C8, DAC CC) carry the frame size.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
          return { height: dv.getUint16(i + 5), width: dv.getUint16(i + 7) }
        i += 2 + dv.getUint16(i + 2)
      }
      return null
    }
    const chunk = ascii(b, 12, 16)
    if (chunk === 'VP8 ' && b.length >= 30) return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
    if (chunk === 'VP8L' && b.length >= 25) {
      const bits = dv.getUint32(21, true)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X' && b.length >= 30) return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
    return null
  } catch {
    return null
  }
}

let crcTable: Uint32Array | null = null
export function crc32(b: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface PngStructure {
  width: number
  height: number
  bitDepth: number
  colorType: number
  interlace: number
  /** Concatenated IDAT payload (zlib stream). */
  idat: Uint8Array[]
}

/**
 * Walk every PNG chunk: lengths must fit the file, CRCs must match, IHDR must
 * come first, at least one IDAT must exist and an IEND must close the image.
 * Returns null for anything malformed or truncated.
 */
export function parsePngStructure(b: Uint8Array): PngStructure | null {
  if (sniffFormat(b) !== 'png') return null
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let pos = 8
  let ihdr: Omit<PngStructure, 'idat'> | null = null
  const idat: Uint8Array[] = []
  let ended = false
  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos)
    const type = ascii(b, pos + 4, pos + 8)
    const dataEnd = pos + 8 + len
    if (len > 0x7fffffff || dataEnd + 4 > b.length) return null
    if (crc32(b.subarray(pos + 4, dataEnd)) !== dv.getUint32(dataEnd)) return null
    if (!ihdr && type !== 'IHDR') return null
    if (type === 'IHDR') {
      if (ihdr || len !== 13) return null
      ihdr = {
        width: dv.getUint32(pos + 8),
        height: dv.getUint32(pos + 12),
        bitDepth: b[pos + 16],
        colorType: b[pos + 17],
        interlace: b[pos + 20],
      }
    } else if (type === 'IDAT') idat.push(b.subarray(pos + 8, dataEnd))
    else if (type === 'IEND') {
      ended = true
      pos = dataEnd + 4
      break
    }
    pos = dataEnd + 4
  }
  // Trailing bytes after IEND are tolerated (some tools append data); truncation is not.
  if (!ihdr || !ended || !idat.length || pos > b.length) return null
  if (!ihdr.width || !ihdr.height || ihdr.interlace > 1) return null
  return { ...ihdr, idat }
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }

/** Exact size of the decompressed IDAT stream (filter byte + packed pixels per row). */
export function expectedPngDataSize(p: Pick<PngStructure, 'width' | 'height' | 'bitDepth' | 'colorType' | 'interlace'>): number | null {
  const channels = CHANNELS[p.colorType]
  if (!channels || ![1, 2, 4, 8, 16].includes(p.bitDepth)) return null
  const rowBytes = (w: number) => Math.ceil((w * channels * p.bitDepth) / 8)
  if (p.interlace === 0) return p.height * (1 + rowBytes(p.width))
  // Adam7: seven reduced images, each with its own rows.
  const passes = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
  ]
  let total = 0
  for (const [x0, y0, dx, dy] of passes) {
    const w = Math.ceil((p.width - x0) / dx)
    const h = Math.ceil((p.height - y0) / dy)
    if (w > 0 && h > 0) total += h * (1 + rowBytes(w))
  }
  return total
}

/**
 * JPEG sanity check: well-formed segments from SOI up to a start-of-scan
 * marker and an end-of-image marker at the end (catches truncated uploads,
 * which pdf-lib would otherwise embed as a broken image).
 */
export function isWellFormedJpeg(b: Uint8Array): boolean {
  if (sniffFormat(b) !== 'jpeg') return false
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let i = 2
  let sawFrame = false
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return false
    const marker = b[i + 1]
    if (marker === 0xff) {
      i++
      continue
    }
    if (marker === 0xda) break // SOS: entropy-coded data follows
    if (marker === 0xd9) return false // EOI before any scan
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2
      continue
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) sawFrame = true
    i += 2 + dv.getUint16(i + 2)
  }
  if (!sawFrame || i + 4 > b.length) return false
  // Allow trailing padding after EOI.
  let end = b.length
  while (end > i && b[end - 1] === 0x00) end--
  return b[end - 2] === 0xff && b[end - 1] === 0xd9
}
