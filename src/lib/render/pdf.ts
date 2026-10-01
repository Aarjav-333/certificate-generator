import { fontkit } from '../fonts/fontkit.js'
import { familyOfFont } from '../fonts/registry.js'
import { LineCapStyle, PDFDocument, rgb, type PDFFont, type PDFImage } from 'pdf-lib'
import type { CertificateLayout } from '../layout/displayList.js'
import type { FontSet } from '../layout/measure.js'
import { dataUrlToBytes } from '../../utils/dataUrl.js'
import { hexToRgb01 } from '../../utils/color.js'

export interface PdfMeta {
  title: string
  author?: string
  subject?: string
}

/**
 * Render a composed certificate as a single-page vector PDF with embedded
 * (subsetted) fonts. Page size is taken from the template in points, so the
 * physical size is exact (A4 landscape = 297 × 210 mm).
 */
export async function renderPdf(layout: CertificateLayout, fonts: FontSet, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(meta.title)
  if (meta.author) doc.setAuthor(meta.author)
  if (meta.subject) doc.setSubject(meta.subject)
  doc.setCreator('Certificate Generator')
  doc.setProducer('Certificate Generator (pdf-lib)')

  const { width: W, height: H } = layout.page
  const page = doc.addPage([W, H])

  const pdfFonts = new Map<string, PDFFont>()
  for (const key of layout.fonts) {
    const f = fonts.get(key)
    if (!f) throw new Error(`Font not loaded: ${key}`)
    const subset = familyOfFont(key)?.pdfSubset ?? false
    pdfFonts.set(key, await doc.embedFont(new Uint8Array(f.bytes), { subset }))
  }

  const images = new Map<string, PDFImage>()
  const getImage = async (id: string, src: string, mime: string) => {
    let img = images.get(id)
    if (!img) {
      const bytes = dataUrlToBytes(src)
      img = mime === 'image/jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
      images.set(id, img)
    }
    return img
  }

  const color = (hex: string) => {
    const [r, g, b] = hexToRgb01(hex)
    return rgb(r, g, b)
  }

  for (const p of layout.prims) {
    switch (p.kind) {
      case 'rect':
        page.drawRectangle({
          x: p.x,
          y: H - p.y - p.h,
          width: p.w,
          height: p.h,
          color: p.fill && p.fill !== 'none' ? color(p.fill) : undefined,
          opacity: p.opacity,
          borderColor: p.stroke ? color(p.stroke) : undefined,
          borderWidth: p.stroke ? p.strokeWidth ?? 1 : 0,
          borderOpacity: p.opacity,
        })
        break
      case 'line':
        page.drawLine({
          start: { x: p.x1, y: H - p.y1 },
          end: { x: p.x2, y: H - p.y2 },
          thickness: p.width,
          color: color(p.color),
          lineCap: LineCapStyle.Butt,
        })
        break
      case 'path':
        page.drawSvgPath(p.d, {
          x: p.x,
          y: H - p.y,
          scale: p.scale,
          color: p.fill ? color(p.fill) : undefined,
          borderColor: p.stroke ? color(p.stroke) : undefined,
          borderWidth: p.stroke ? p.strokeWidth ?? 1 : 0,
        })
        break
      case 'image': {
        const img = await getImage(p.assetId, p.src, p.mime)
        page.drawImage(img, { x: p.x, y: H - p.y - p.h, width: p.w, height: p.h, opacity: p.opacity })
        break
      }
      case 'text': {
        // One glyph per call at the engine's position: no shaping by pdf-lib,
        // so kerning and spacing are exactly those of the preview.
        const font = pdfFonts.get(p.font)!
        const c = color(p.color)
        ;[...p.text].forEach((ch, i) => {
          if (ch !== ' ') page.drawText(ch, { x: p.xs[i], y: H - p.y, size: p.size, font, color: c })
        })
        break
      }
    }
  }

  return doc.save()
}
