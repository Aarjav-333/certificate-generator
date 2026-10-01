import { getTemplate, type TemplateDefinition } from '../templates/index.js'
import { BORDER_STYLES } from '../templates/borders.js'
import {
  MAX_SIGNATORIES,
  type CertificateConfig,
  type DesignSettings,
  type EventGraphicPlacement,
  type ImageAsset,
  type Signatory,
} from '../types/certificate.js'
import { DATE_FORMATS, parseIsoDate } from '../utils/date.js'
import { normalizeHex } from '../utils/color.js'
import { newId } from '../utils/dataUrl.js'
import { FONT_FAMILIES } from './fonts/registry.js'
import { isValidAsset } from './assets.js'

export function blankSignatory(): Signatory {
  return {
    id: newId(),
    name: '',
    designation: '',
    organization: '',
    signature: null,
    showSignature: true,
    signatureScale: 1,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
  }
}

/** An empty certificate that keeps the template's wording and design. */
export function blankConfig(templateId: string): CertificateConfig {
  const tpl = getTemplate(templateId)
  const t = tpl.defaults
  return {
    version: 1,
    templateId: tpl.id,
    institution: { name: '', subtitle: '', department: '', logo: null, logoSize: t.logoSize },
    title: t.title,
    titleTagline: t.titleTagline,
    participant: { salutation: '', name: '', designation: '', department: '', institution: '' },
    event: { name: '', type: '', organizer: '', venue: '', startDate: '', endDate: '', description: '' },
    issueDate: '',
    body: t.body,
    eventGraphic: { image: null, placement: 'top-right', size: t.graphicSize, opacity: 1 },
    background: { image: null, fade: 0.72 },
    signatories: [blankSignatory()],
    design: { ...t.design },
  }
}

/**
 * Switch template: take over its design and default sizes. The wording is
 * only replaced if the user hasn't customised it.
 */
export function applyTemplate(cfg: CertificateConfig, next: TemplateDefinition): CertificateConfig {
  const prev = getTemplate(cfg.templateId)
  const bodyUntouched = cfg.body.trim() === prev.defaults.body.trim() || !cfg.body.trim()
  const titleUntouched = cfg.title === prev.defaults.title && cfg.titleTagline === prev.defaults.titleTagline
  return {
    ...cfg,
    templateId: next.id,
    body: bodyUntouched ? next.defaults.body : cfg.body,
    title: titleUntouched ? next.defaults.title : cfg.title,
    titleTagline: titleUntouched ? next.defaults.titleTagline : cfg.titleTagline,
    institution: { ...cfg.institution, logoSize: next.defaults.logoSize },
    eventGraphic: { ...cfg.eventGraphic, size: next.defaults.graphicSize },
    design: { ...next.defaults.design, dateFormat: cfg.design.dateFormat },
  }
}

// ── Normalisation of untrusted input (imported JSON / old saved drafts) ─────

const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown, def: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def)
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], def: T): T =>
  allowed.includes(v as T) ? (v as T) : def
const date = (v: unknown): string => (typeof v === 'string' && parseIsoDate(v) ? v : '')
const asset = (v: unknown): ImageAsset | null => {
  if (!isValidAsset(v)) return null
  const a = v as ImageAsset
  return { ...a, id: str(a.id, 100) || newId(), name: str(a.name, 200) || 'image', alt: str(a.alt, 300) }
}
const color = (v: unknown, def: string): string => (typeof v === 'string' && normalizeHex(v)) || def
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

export class ConfigImportError extends Error {}

export function normalizeConfig(raw: unknown): CertificateConfig {
  const r = obj(raw)
  if (!Object.keys(r).length) throw new ConfigImportError('The file does not contain a certificate configuration.')
  const tpl = getTemplate(str(r.templateId))
  const base = blankConfig(tpl.id)
  const inst = obj(r.institution)
  const part = obj(r.participant)
  const ev = obj(r.event)
  const g = obj(r.eventGraphic)
  const bg = obj(r.background)
  const d = obj(r.design)
  const fontIds = FONT_FAMILIES.map((f) => f.id)
  const td = tpl.defaults.design
  const design: DesignSettings = {
    primaryFont: oneOf(d.primaryFont, fontIds, td.primaryFont),
    secondaryFont: oneOf(d.secondaryFont, fontIds, td.secondaryFont),
    displayFont: oneOf(d.displayFont, fontIds, td.displayFont),
    headingColor: color(d.headingColor, td.headingColor),
    accentColor: color(d.accentColor, td.accentColor),
    textColor: color(d.textColor, td.textColor),
    bodyAlign: oneOf(d.bodyAlign, ['justify', 'center', 'left'] as const, td.bodyAlign),
    bodyFontSize: num(d.bodyFontSize, td.bodyFontSize, 8, 28),
    headingFontSize: num(d.headingFontSize, td.headingFontSize, 8, 40),
    titleFontSize: num(d.titleFontSize, td.titleFontSize, 8, 60),
    borderStyle: oneOf(d.borderStyle, BORDER_STYLES.map((b) => b.id), td.borderStyle),
    borderColor: color(d.borderColor, td.borderColor),
    borderWidth: num(d.borderWidth, td.borderWidth, 0.25, 8),
    backgroundColor: color(d.backgroundColor, td.backgroundColor),
    signatureLayout: oneOf(d.signatureLayout, ['auto', 'one-row', 'two-rows'] as const, td.signatureLayout),
    showSignatureLines: bool(d.showSignatureLines, td.showSignatureLines),
    dateFormat: oneOf(d.dateFormat, DATE_FORMATS.map((f) => f.id), td.dateFormat),
  }
  const sigs = Array.isArray(r.signatories) ? r.signatories.slice(0, MAX_SIGNATORIES) : []
  return {
    version: 1,
    templateId: tpl.id,
    institution: {
      name: str(inst.name, 300),
      subtitle: str(inst.subtitle, 300),
      department: str(inst.department, 300),
      logo: asset(inst.logo),
      logoSize: num(inst.logoSize, base.institution.logoSize, 20, 160),
    },
    title: typeof r.title === 'string' ? str(r.title, 120) : base.title,
    titleTagline: typeof r.titleTagline === 'string' ? str(r.titleTagline, 120) : base.titleTagline,
    participant: {
      salutation: str(part.salutation, 40),
      name: str(part.name, 200),
      designation: str(part.designation, 200),
      department: str(part.department, 300),
      institution: str(part.institution, 300),
    },
    event: {
      name: str(ev.name, 400),
      type: str(ev.type, 200),
      organizer: str(ev.organizer, 300),
      venue: str(ev.venue, 300),
      startDate: date(ev.startDate),
      endDate: date(ev.endDate),
      description: str(ev.description, 2000),
    },
    issueDate: date(r.issueDate),
    body: typeof r.body === 'string' ? str(r.body, 5000) : base.body,
    eventGraphic: {
      image: asset(g.image),
      placement: oneOf<EventGraphicPlacement>(g.placement, ['top-left', 'top-right', 'above-title', 'watermark'], 'top-right'),
      size: num(g.size, base.eventGraphic.size, 20, 200),
      opacity: num(g.opacity, 1, 0.03, 1),
    },
    background: { image: asset(bg.image), fade: num(bg.fade, 0.72, 0, 1) },
    signatories: sigs.map((s) => {
      const o = obj(s)
      return {
        id: str(o.id, 100) || newId(),
        name: str(o.name, 200),
        designation: str(o.designation, 200),
        organization: str(o.organization, 300),
        signature: asset(o.signature),
        showSignature: bool(o.showSignature, true),
        signatureScale: num(o.signatureScale, 1, 0.4, 1.8),
        signatureOffsetX: num(o.signatureOffsetX, 0, -60, 60),
        signatureOffsetY: num(o.signatureOffsetY, 0, -30, 30),
      }
    }),
    design,
  }
}

export const EXPORT_FORMAT = 'certificate-generator/config'

export function serializeConfig(cfg: CertificateConfig): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: new Date().toISOString(), config: cfg }, null, 2)
}

export function parseConfigJson(text: string): CertificateConfig {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ConfigImportError('The file is not valid JSON.')
  }
  const o = obj(data)
  if (o.format && o.format !== EXPORT_FORMAT) throw new ConfigImportError('This JSON file was not exported by the Certificate Generator.')
  return normalizeConfig(o.config ?? o)
}
