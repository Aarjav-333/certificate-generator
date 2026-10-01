import { describe, expect, it } from 'vitest'
import { crc32, expectedPngDataSize, isWellFormedJpeg, parsePngStructure, readDimensions, sniffFormat } from './imageFormat.js'

const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// 4×3 px fixtures.
const PNG = fromB64(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAAAZSURBVAiZYzhjbPz/jLHxfwYoYGJAAxgCAMvNBGccYzIQAAAAAElFTkSuQmCC',
)
const JPG = fromB64(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAaEAEAAQUAAAAAAAAAAAAAAAAAAwUHN4S0/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAeEQAABAcAAAAAAAAAAAAAAAAAAQMEBjQ1cnOxsv/aAAwDAQACEQMRAD8AnVfzLVd1eaIAZnLJ2loWYjrLvKp2Y//Z',
)

describe('imageFormat', () => {
  it('sniffs formats from signatures, not declared types', () => {
    expect(sniffFormat(PNG)).toBe('png')
    expect(sniffFormat(JPG)).toBe('jpeg')
    expect(sniffFormat(new TextEncoder().encode('<svg xmlns="x"/>'))).toBe('svg')
    expect(sniffFormat(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('reads dimensions from headers', () => {
    expect(readDimensions(PNG, 'png')).toEqual({ width: 4, height: 3 })
    expect(readDimensions(JPG, 'jpeg')).toEqual({ width: 4, height: 3 })
  })

  it('accepts a complete PNG and computes its data size', () => {
    const png = parsePngStructure(PNG)
    expect(png).not.toBeNull()
    expect(expectedPngDataSize(png!)).toBe(3 * (1 + 4 * 4)) // RGBA, 8-bit
  })

  it('rejects truncated PNGs (which hang the PDF writer) and bad CRCs', () => {
    for (let cut = 20; cut < PNG.length; cut += 7) expect(parsePngStructure(PNG.subarray(0, cut))).toBeNull()
    const bad = PNG.slice()
    bad[bad.length - 20] ^= 0xff
    expect(parsePngStructure(bad)).toBeNull()
  })

  it('tolerates harmless trailing bytes after IEND', () => {
    const withTrailer = new Uint8Array([...PNG, 1, 2, 3, 4])
    expect(parsePngStructure(withTrailer)).not.toBeNull()
  })

  it('accepts a complete JPEG and rejects a truncated one', () => {
    expect(isWellFormedJpeg(JPG)).toBe(true)
    expect(isWellFormedJpeg(JPG.subarray(0, JPG.length - 10))).toBe(false)
    expect(isWellFormedJpeg(JPG.subarray(0, 40))).toBe(false)
  })

  it('computes standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})
