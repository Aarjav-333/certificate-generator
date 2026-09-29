import { composeCertificate, requiredFonts } from '../templates/engine'
import { getTemplate } from '../templates'
import type { CertificateConfig } from '../types/certificate'
import { downloadBlob, safeFileName } from '../utils/download'
import { loadFonts } from './fonts/loader'
import { canvasToBlob, renderCanvas } from './render/canvas'

/** Load fonts and compose — the exact same path the live preview uses. */
export async function buildLayout(cfg: CertificateConfig) {
  const fonts = await loadFonts(requiredFonts(cfg))
  const layout = composeCertificate(cfg, getTemplate(cfg.templateId), fonts)
  return { fonts, layout }
}

export function certificateFileName(cfg: CertificateConfig): string {
  return safeFileName('certificate', cfg.participant.name || cfg.event.name)
}

export async function exportPdf(cfg: CertificateConfig): Promise<Blob> {
  // pdf-lib is only needed here, so it is loaded on demand.
  const [{ fonts, layout }, { renderPdf }] = await Promise.all([buildLayout(cfg), import('./render/pdf')])
  const bytes = await renderPdf(layout, fonts, {
    title: [cfg.title, cfg.participant.name].filter(Boolean).join(' — '),
    author: cfg.institution.name,
    subject: cfg.event.name,
  })
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

export async function exportImage(cfg: CertificateConfig, type: 'image/png' | 'image/jpeg', dpi = 300): Promise<Blob> {
  const { layout } = await buildLayout(cfg)
  const canvas = await renderCanvas(layout, dpi)
  return canvasToBlob(canvas, type, 0.95)
}

export async function downloadPdf(cfg: CertificateConfig): Promise<void> {
  downloadBlob(await exportPdf(cfg), `${certificateFileName(cfg)}.pdf`)
}

export async function downloadImage(cfg: CertificateConfig, type: 'image/png' | 'image/jpeg', dpi = 300): Promise<void> {
  downloadBlob(await exportImage(cfg, type, dpi), `${certificateFileName(cfg)}.${type === 'image/png' ? 'png' : 'jpg'}`)
}
