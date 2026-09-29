import { getFamily } from '../lib/fonts/registry'
import type { CertificateLayout, ImagePrim, Prim, TextPrim } from '../lib/layout/displayList'
import { missingGlyphs, type FontSet } from '../lib/layout/measure'
import { fitParagraphs, plainParagraph, type TextStyle } from '../lib/layout/textLayout'
import { buildVariables, renderTemplate } from '../lib/text/placeholders'
import { parseRichText } from '../lib/text/richText'
import type { CertificateConfig, DesignSettings, ImageAsset, Signatory } from '../types/certificate'
import { borderPrims } from './borders'
import type { ColorRole, FontRole, LineSpec, TemplateDefinition, TemplateLayout } from './types'

function colorFor(role: ColorRole, d: DesignSettings): string {
  return role === 'heading' ? d.headingColor : role === 'accent' ? d.accentColor : d.textColor
}

function familyFor(role: FontRole, d: DesignSettings): string {
  return role === 'primary' ? d.primaryFont : role === 'secondary' ? d.secondaryFont : d.displayFont
}

/** Font files a config needs — load these before calling composeCertificate. */
export function requiredFonts(cfg: CertificateConfig): string[] {
  const d = cfg.design
  const keys = new Set<string>()
  for (const fam of [d.primaryFont, d.secondaryFont, d.displayFont]) {
    for (const v of getFamily(fam).variants) keys.add(v.file)
  }
  return [...keys]
}

function translate<T extends Prim>(prims: T[], dx: number, dy: number): T[] {
  if (!dx && !dy) return prims
  return prims.map((p) => {
    switch (p.kind) {
      case 'line':
        return { ...p, x1: p.x1 + dx, x2: p.x2 + dx, y1: p.y1 + dy, y2: p.y2 + dy }
      case 'text':
        return { ...p, x: p.x + dx, y: p.y + dy, xs: dx ? p.xs.map((x) => x + dx) : p.xs }
      default:
        return { ...p, x: p.x + dx, y: p.y + dy }
    }
  })
}

/** Fit an image inside a box, preserving aspect ratio. */
function containImage(asset: ImageAsset, boxW: number, boxH: number): { w: number; h: number } {
  const ar = asset.width / asset.height
  let w = boxW
  let h = w / ar
  if (h > boxH) {
    h = boxH
    w = h * ar
  }
  return { w, h }
}

function imagePrim(asset: ImageAsset, x: number, y: number, w: number, h: number, opacity?: number): ImagePrim {
  return { kind: 'image', assetId: asset.id, src: asset.dataUrl, mime: asset.mime, x, y, w, h, opacity, alt: asset.alt || asset.name }
}

/**
 * Tighten a template's vertical rhythm by factor k (1 = as designed). Used when
 * content is dense (long text, two rows of signatories): spacing gives way
 * before the text is made smaller.
 */
function densify(L: TemplateLayout, k: number): TemplateLayout {
  if (k === 1) return L
  const gap = <T extends { gapAfter: number }>(spec: T): T => ({ ...spec, gapAfter: spec.gapAfter * k })
  const lead = (lh: number, f: number) => 1 + (lh - 1) * f
  return {
    ...L,
    margin: { ...L.margin, top: L.margin.top * (0.7 + 0.3 * k), bottom: L.margin.bottom * (0.7 + 0.3 * k) },
    heading: gap(L.heading),
    subtitle: gap(L.subtitle),
    department: gap(L.department),
    title: gap(L.title),
    tagline: gap(L.tagline),
    logo: gap(L.logo),
    graphicAboveTitle: gap(L.graphicAboveTitle),
    body: {
      ...L.body,
      gapBefore: L.body.gapBefore * k,
      minGapToSignatures: L.body.minGapToSignatures * k,
      lineHeight: lead(L.body.lineHeight, 0.7 + 0.3 * k),
    },
    signatures: {
      ...L.signatures,
      imageHeight: L.signatures.imageHeight * (0.6 + 0.4 * k),
      rowGap: L.signatures.rowGap * k,
      lineHeight: lead(L.signatures.lineHeight, 0.6 + 0.4 * k),
    },
  }
}

export interface ComposeResult extends CertificateLayout {
  /** Final body font size after auto-fit. */
  bodySize: number
  bodyOverflow: boolean
  /** 1 = template spacing as designed; lower = tightened to fit. */
  density: number
}

const DENSITIES = [1, 0.85, 0.7, 0.55]

/**
 * Compose a certificate into a display list. Pure function of config +
 * template + loaded fonts, so preview and export are guaranteed to agree.
 *
 * If content does not fit comfortably, spacing is tightened step by step
 * (logo, gaps, leading) before the body text is reduced further.
 */
export function composeCertificate(cfg: CertificateConfig, tpl: TemplateDefinition, fonts: FontSet): ComposeResult {
  let best: ComposeResult | null = null
  for (const k of DENSITIES) {
    const r = composeAt(cfg, tpl, fonts, k)
    if (!r.bodyOverflow && r.bodySize >= cfg.design.bodyFontSize * 0.88) return r
    const better =
      !best || (best.bodyOverflow && !r.bodyOverflow) || (r.bodyOverflow === best.bodyOverflow && r.bodySize > best.bodySize)
    if (better) best = r
  }
  return best!
}

function composeAt(cfg: CertificateConfig, tpl: TemplateDefinition, fonts: FontSet, density: number): ComposeResult {
  const L = densify(tpl.layout, density)
  const d = cfg.design
  const page = L.page
  const warnings: string[] = []
  const back: Prim[] = []
  const fixed: Prim[] = []
  /** Header + body — shifted down as one block when there are no signatories. */
  const flow: Prim[] = []

  // ── Background ─────────────────────────────────────────────────────────
  back.push({ kind: 'rect', x: 0, y: 0, w: page.width, h: page.height, fill: d.backgroundColor })
  const bg = cfg.background.image
  if (bg) {
    // "cover" — scale to fill the page, centre, and let the page clip it.
    const scale = Math.max(page.width / bg.width, page.height / bg.height)
    const w = bg.width * scale
    const h = bg.height * scale
    back.push(imagePrim(bg, (page.width - w) / 2, (page.height - h) / 2, w, h))
    if (cfg.background.fade > 0) {
      back.push({ kind: 'rect', x: 0, y: 0, w: page.width, h: page.height, fill: d.backgroundColor, opacity: cfg.background.fade })
    }
  }
  if (tpl.decorate) back.push(...tpl.decorate({ page, design: d, layout: L }))
  back.push(...borderPrims(page, d.borderStyle, d.borderColor, d.borderWidth, L.borderInset))

  const contentX = L.margin.left
  const contentW = page.width - L.margin.left - L.margin.right

  // ── Corner event graphic (narrows the header so nothing collides) ─────
  const g = cfg.eventGraphic
  let headerInset = 0
  if (g.image && (g.placement === 'top-left' || g.placement === 'top-right')) {
    const { w, h } = containImage(g.image, g.size * 1.6, g.size)
    const x = g.placement === 'top-left' ? contentX : contentX + contentW - w
    fixed.push(imagePrim(g.image, x, tpl.layout.margin.top, w, h, g.opacity))
    headerInset = w + 14
  }

  // ── Signatures (anchored to the bottom) ───────────────────────────────
  const sig = composeSignatures(cfg, L, fonts, warnings)
  const sigTop = page.height - L.margin.bottom - sig.height
  fixed.push(...translate(sig.prims, 0, sigTop))

  // ── Header stack ──────────────────────────────────────────────────────
  let y = L.margin.top
  const headerW = contentW - headerInset * 2
  const headerX = contentX + headerInset

  const textLine = (text: string, spec: Omit<LineSpec, 'scale'>, size: number, maxLines = 1, minRatio = 0.72, label?: string) => {
    const content = spec.uppercase ? text.toUpperCase() : text
    const paras = plainParagraph(content, spec.bold, spec.italic)
    if (!paras.length) return
    const style: TextStyle = {
      family: familyFor(spec.font, d),
      size,
      lineHeight: 'lineHeight' in spec ? (spec as { lineHeight: number }).lineHeight : 1.25,
      align: 'center',
      color: colorFor(spec.color, d),
      letterSpacing: spec.letterSpacing,
    }
    let block = fitParagraphs(fonts, paras, style, headerX, y, headerW, { maxLines: 1, minSize: size * minRatio })
    if (block.overflow && maxLines > 1) {
      block = fitParagraphs(fonts, paras, { ...style, size: size * minRatio }, headerX, y, headerW, { maxLines, minSize: size * 0.6 })
    }
    if (block.overflow && label) warnings.push(`${label} is too long for the available width.`)
    flow.push(...block.prims)
    y += block.height + spec.gapAfter
  }

  const imageScale = 0.55 + 0.45 * density
  for (const item of L.headerOrder) {
    switch (item) {
      case 'heading':
        textLine(cfg.institution.name, L.heading, d.headingFontSize, L.heading.maxLines, 0.72, 'Institution name')
        break
      case 'subtitle':
        textLine(cfg.institution.subtitle, L.subtitle, d.headingFontSize * L.subtitle.scale, 2, 0.75, 'Institution subtitle')
        break
      case 'department':
        textLine(cfg.institution.department, L.department, d.headingFontSize * L.department.scale, 2, 0.75, 'Department')
        break
      case 'logo': {
        const logo = cfg.institution.logo
        if (!logo) break
        const { w, h } = containImage(logo, contentW * L.logo.maxWidthRatio, cfg.institution.logoSize * imageScale)
        flow.push(imagePrim(logo, contentX + (contentW - w) / 2, y, w, h))
        y += h + L.logo.gapAfter
        break
      }
      case 'graphic': {
        if (!g.image || g.placement !== 'above-title') break
        const { w, h } = containImage(g.image, contentW * 0.4, g.size * imageScale)
        flow.push(imagePrim(g.image, contentX + (contentW - w) / 2, y, w, h, g.opacity))
        y += h + L.graphicAboveTitle.gapAfter
        break
      }
      case 'title':
        textLine(cfg.title, L.title, d.titleFontSize, 1, 0.6, 'Title')
        if (cfg.titleTagline.trim()) {
          y -= L.title.gapAfter * 0.6
          textLine(cfg.titleTagline, L.tagline, d.titleFontSize * L.tagline.scale, 1, 0.6, 'Title tagline')
        }
        break
    }
  }

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyTop = y + L.body.gapBefore
  const bodyBottom = sig.height ? sigTop - L.body.minGapToSignatures : page.height - L.margin.bottom
  const bodyMaxH = Math.max(0, bodyBottom - bodyTop)
  const bodyW = contentW * L.body.widthRatio
  const bodyX = contentX + (contentW - bodyW) / 2

  const paragraphs = parseRichText(renderTemplate(cfg.body, buildVariables(cfg)))
  const bodyStyle: TextStyle = {
    family: d.secondaryFont,
    size: d.bodyFontSize,
    lineHeight: L.body.lineHeight,
    align: d.bodyAlign,
    color: d.textColor,
    emphasisColor: d.accentColor,
    display: { family: d.displayFont, scale: L.body.displayScale, color: d.accentColor, bold: L.body.displayBold },
  }
  const body = fitParagraphs(fonts, paragraphs, bodyStyle, bodyX, bodyTop, bodyW, { maxHeight: bodyMaxH, minSize: L.body.minSize })
  let bodyOffset = 0
  if (L.body.vAlign === 'center' && sig.height > 0 && body.height < bodyMaxH) bodyOffset = (bodyMaxH - body.height) / 2
  if (body.overflow) warnings.push('The certificate text is too long to fit above the signatures even at the smallest size. Shorten the description.')
  else if (body.shrunk) warnings.push(`Certificate text was reduced from ${d.bodyFontSize}pt to ${+body.size.toFixed(2)}pt so it fits.`)
  flow.push(...translate(body.prims, 0, bodyOffset))

  // Without signatories, centre the header + body block rather than leaving the page top-heavy.
  let flowShift = 0
  if (sig.height === 0) {
    const used = bodyTop + body.height - L.margin.top
    const avail = page.height - L.margin.top - L.margin.bottom
    flowShift = Math.max(0, (avail - used) * 0.45)
  }

  // Watermark sits behind the body text.
  if (g.image && g.placement === 'watermark') {
    const areaTop = bodyTop + flowShift - 10
    const areaH = Math.max(40, (sig.height ? sigTop : page.height - L.margin.bottom) - areaTop)
    const { w, h } = containImage(g.image, contentW * 0.6, Math.min(g.size * 2.4, areaH))
    back.push(imagePrim(g.image, contentX + (contentW - w) / 2, areaTop + (areaH - h) / 2, w, h, g.opacity))
  }

  const prims = [...fixed, ...translate(flow, 0, flowShift)]

  // ── Glyph coverage check ──────────────────────────────────────────────
  const missingByFont = new Map<string, Set<string>>()
  for (const p of prims) {
    if (p.kind !== 'text') continue
    for (const ch of missingGlyphs(fonts, p.font, p.text)) {
      if (!missingByFont.has(p.font)) missingByFont.set(p.font, new Set())
      missingByFont.get(p.font)!.add(ch)
    }
  }
  for (const [font, chars] of missingByFont) {
    const fam = font.replace(/-\d{3}-(normal|italic)\.ttf$/, '')
    warnings.push(`The font "${getFamily(fam).label}" has no glyphs for: ${[...chars].join(' ')} — choose another font or remove these characters.`)
  }

  const all = [...back, ...prims]
  const fontsUsed = [...new Set(all.filter((p): p is TextPrim => p.kind === 'text').map((p) => p.font))]
  return { page, prims: all, warnings, fonts: fontsUsed, bodySize: body.size, bodyOverflow: body.overflow, density }
}

/** Arrange signatories into rows: 1 → centred, 2–5 → one row, 6 → two rows of three (auto). */
export function signatureRows(count: number, mode: DesignSettings['signatureLayout']): number[] {
  if (count === 0) return []
  const twoRows = mode === 'two-rows' ? count >= 2 : mode === 'auto' ? count >= 6 : false
  if (!twoRows) return [count]
  const top = Math.ceil(count / 2)
  return [top, count - top]
}

function composeSignatures(cfg: CertificateConfig, L: TemplateLayout, fonts: FontSet, warnings: string[]): { prims: Prim[]; height: number } {
  const S = L.signatures
  const d = cfg.design
  const list = cfg.signatories
  const rows = signatureRows(list.length, d.signatureLayout)
  const stripX = L.margin.left + S.sidePadding
  const stripW = L.page.width - L.margin.left - L.margin.right - S.sidePadding * 2
  const nameSize = d.bodyFontSize * S.nameScale
  const detailSize = d.bodyFontSize * S.detailScale
  const prims: Prim[] = []
  let y = 0
  let idx = 0

  rows.forEach((n, ri) => {
    const members = list.slice(idx, idx + n)
    idx += n
    // Columns are sized for the widest row so a 3+2 split stays on the same grid.
    const colW = stripW / Math.max(n, rows[0])
    const rowOffset = (stripW - colW * n) / 2
    const blocks = members.map((s) => signatoryBlock(s, cfg, fonts, colW, nameSize, detailSize, S, warnings))
    const rowH = Math.max(...blocks.map((b) => b.height))
    // Every block reserves the same signature height, so names line up across the row.
    blocks.forEach((b, i) => prims.push(...translate(b.prims, stripX + rowOffset + colW * i, y)))
    y += rowH + (ri < rows.length - 1 ? S.rowGap : 0)
  })
  return { prims, height: y }
}

function signatoryBlock(
  s: Signatory,
  cfg: CertificateConfig,
  fonts: FontSet,
  colW: number,
  nameSize: number,
  detailSize: number,
  S: TemplateLayout['signatures'],
  warnings: string[],
): { prims: Prim[]; height: number } {
  const d = cfg.design
  const prims: Prim[] = []
  const pad = 6
  const innerW = colW - pad * 2
  const imgH = S.imageHeight
  // Signature image — bottom-aligned on the signing line, never stretched.
  if (s.signature && s.showSignature) {
    const boxH = imgH * s.signatureScale
    const { w, h } = containImage(s.signature, Math.min(innerW, boxH * 4), boxH)
    prims.push(imagePrim(s.signature, (colW - w) / 2 + s.signatureOffsetX, imgH - h + s.signatureOffsetY, w, h))
  }
  let y = imgH
  const family = d.secondaryFont
  const nameParas = plainParagraph(s.name, S.nameBold, false)
  const nameStyle: TextStyle = { family, size: nameSize, lineHeight: S.lineHeight, align: 'center', color: d.textColor }
  let name = fitParagraphs(fonts, nameParas, nameStyle, pad, 0, innerW, { maxLines: 1, minSize: nameSize * 0.75 })
  if (name.overflow) {
    name = fitParagraphs(fonts, nameParas, { ...nameStyle, size: nameSize * 0.75 }, pad, 0, innerW, { maxLines: 2, minSize: nameSize * 0.6 })
    if (name.overflow) warnings.push(`Signatory name "${s.name}" is too long for its column.`)
  }
  if (d.showSignatureLines) {
    const lineW = Math.min(innerW, Math.max(S.lineMaxWidth * 0.75, Math.min(S.lineMaxWidth, name.maxLineWidth + 24)))
    prims.push({ kind: 'line', x1: (colW - lineW) / 2, y1: y + 2, x2: (colW + lineW) / 2, y2: y + 2, color: d.textColor, width: 0.6 })
    y += 4
  }
  y += S.gapBelowImage
  prims.push(...translate(name.prims, 0, y))
  y += name.height
  for (const detail of [s.designation, s.organization]) {
    const paras = plainParagraph(detail)
    if (!paras.length) continue
    const style: TextStyle = { family, size: detailSize, lineHeight: S.lineHeight, align: 'center', color: d.textColor }
    const b = fitParagraphs(fonts, paras, style, pad, 0, innerW, { maxLines: 2, minSize: detailSize * 0.75 })
    prims.push(...translate(b.prims, 0, y))
    y += b.height
  }
  return { prims, height: y }
}
