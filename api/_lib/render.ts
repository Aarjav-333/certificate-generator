import { certificateBaseName } from '../../src/lib/api/batch.js'
import type { CertificateLayout } from '../../src/lib/layout/displayList.js'
import type { FontSet } from '../../src/lib/layout/measure.js'
import type { DrawContext } from '../../src/lib/render/draw.js'
import { drawLayout } from '../../src/lib/render/draw.js'
import { renderPdf } from '../../src/lib/render/pdf.js'
import { getTemplate } from '../../src/templates/index.js'
import { composeCertificate, requiredFonts } from '../../src/templates/engine.js'
import type { CertificateConfig } from '../../src/types/certificate.js'
import { loadServerFonts } from './fonts.js'

export interface Rendered {
  bytes: Uint8Array
  /** Layout notes such as "text was reduced to fit" — returned in a response header. */
  warnings: string[]
  /** Safe base file name, e.g. "Aarjav-Oravakandi". */
  baseName: string
}

/** Server counterpart of the browser's buildLayout(): same engine, fonts read from disk. */
export async function buildServerLayout(cfg: CertificateConfig): Promise<{ fonts: FontSet; layout: CertificateLayout }> {
  const fonts = await loadServerFonts(requiredFonts(cfg))
  const layout = composeCertificate(cfg, getTemplate(cfg.templateId), fonts)
  return { fonts, layout }
}

/** Generate the certificate PDF — byte-for-byte the same renderer the web app uses. */
export async function renderCertificatePdf(cfg: CertificateConfig): Promise<Rendered> {
  const { fonts, layout } = await buildServerLayout(cfg)
  const bytes = await renderPdf(layout, fonts, {
    title: [cfg.title, cfg.participant.name].filter(Boolean).join(' — '),
    author: cfg.institution.name,
    subject: cfg.event.name,
  })
  return { bytes, warnings: layout.warnings, baseName: certificateBaseName(cfg.participant.name, 'certificate') }
}

const registeredFonts = new Set<string>()

/**
 * Rasterise the certificate to PNG with Skia (@napi-rs/canvas, prebuilt for
 * Vercel's Linux runtime). Uses the same display list and drawing routine as
 * the browser PNG export.
 */
export async function renderCertificatePng(cfg: CertificateConfig, dpi: number): Promise<Rendered> {
  const { fonts, layout } = await buildServerLayout(cfg)
  const { createCanvas, GlobalFonts, loadImage, Path2D } = await import('@napi-rs/canvas')

  for (const key of layout.fonts) {
    const f = fonts.get(key)!
    if (registeredFonts.has(key)) continue
    // Register under the exact family name the drawer asks for; fail loudly
    // rather than letting Skia fall back to a system font.
    if (!GlobalFonts.register(Buffer.from(f.bytes), f.cssFamily)) throw new Error(`Could not register font ${key}`)
    registeredFonts.add(key)
  }

  const images = new Map<string, unknown>()
  for (const p of layout.prims) {
    if (p.kind === 'image' && !images.has(p.assetId)) {
      images.set(p.assetId, await loadImage(Buffer.from(p.src.slice(p.src.indexOf(',') + 1), 'base64')))
    }
  }

  const scale = dpi / 72
  const canvas = createCanvas(Math.round(layout.page.width * scale), Math.round(layout.page.height * scale))
  drawLayout(canvas.getContext('2d') as unknown as DrawContext, layout, { scale, images, Path2D })
  const bytes = new Uint8Array(await canvas.encode('png'))
  return { bytes, warnings: layout.warnings, baseName: certificateBaseName(cfg.participant.name, 'certificate') }
}
