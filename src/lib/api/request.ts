import { EXPORT_FORMAT, normalizeConfig } from '../config.js'
import { FONT_FAMILIES } from '../fonts/registry.js'
import { exportErrors } from '../validation.js'
import { TEMPLATES } from '../../templates/index.js'
import { BORDER_STYLES } from '../../templates/borders.js'
import { MAX_SIGNATORIES, type CertificateConfig, type ImageAsset } from '../../types/certificate.js'
import { normalizeHex } from '../../utils/color.js'
import { DATE_FORMATS, parseIsoDate } from '../../utils/date.js'
import { ApiError, FieldError, validationError, type FieldIssue } from './errors.js'
import { API_LIMITS } from './limits.js'

/**
 * Turns an image value from a request into an ImageAsset. Accepts a data URL
 * string or an object with a `dataUrl`. Returns null when no image is given.
 * Implemented per platform (the server decodes, validates and converts WebP).
 */
export type ImageDecoder = (value: unknown, field: string) => Promise<ImageAsset | null>

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Maximum lengths — identical to what the web app stores, so nothing is silently truncated. */
const TEXT_LIMITS: Record<string, Record<string, number>> = {
  institution: { name: 300, subtitle: 300, department: 300 },
  participant: { salutation: 40, name: 200, designation: 200, department: 300, institution: 300 },
  event: { name: 400, type: 200, organizer: 300, venue: 300, description: API_LIMITS.maxDescriptionChars },
  signatory: { name: 200, designation: 200, organization: 300 },
}

const NUMBER_RANGES: Record<string, [number, number]> = {
  'institution.logoSize': [20, 160],
  'eventGraphic.size': [20, 200],
  'eventGraphic.opacity': [0.03, 1],
  'background.fade': [0, 1],
  'design.bodyFontSize': [8, 28],
  'design.headingFontSize': [8, 40],
  'design.titleFontSize': [8, 60],
  'design.borderWidth': [0.25, 8],
  'signatory.signatureScale': [0.4, 1.8],
  'signatory.signatureOffsetX': [-60, 60],
  'signatory.signatureOffsetY': [-30, 30],
}

const ENUMS: Record<string, readonly string[]> = {
  'design.primaryFont': FONT_FAMILIES.map((f) => f.id),
  'design.secondaryFont': FONT_FAMILIES.map((f) => f.id),
  'design.displayFont': FONT_FAMILIES.map((f) => f.id),
  'design.bodyAlign': ['justify', 'center', 'left'],
  'design.borderStyle': BORDER_STYLES.map((b) => b.id),
  'design.signatureLayout': ['auto', 'one-row', 'two-rows'],
  'design.dateFormat': DATE_FORMATS.map((f) => f.id),
  'eventGraphic.placement': ['top-left', 'top-right', 'above-title', 'watermark'],
}

const COLORS = ['headingColor', 'accentColor', 'textColor', 'borderColor', 'backgroundColor']

/** Maps field ids used by the web form's validation to API field paths. */
function apiPath(field: string, cfg: CertificateConfig): string {
  const fixed: Record<string, string> = {
    'inst-name': 'institution.name',
    'participant-name': 'participant.name',
    'event-name': 'event.name',
    'event-end': 'event.endDate',
    'body-text': 'body',
  }
  if (fixed[field]) return fixed[field]
  const sig = /^sig-(.+)-name$/.exec(field)
  if (sig) return `signatories[${cfg.signatories.findIndex((s) => s.id === sig[1])}].name`
  return field
}

class Checker {
  readonly issues: FieldIssue[] = []
  /** Set when an image exceeds a size limit: the request is answered with 413 instead of 400. */
  tooLarge: string | null = null
  add(field: string, message: string) {
    this.issues.push({ field, message })
  }

  obj(parent: Obj, key: string, path: string): Obj | undefined {
    const v = parent[key]
    if (v === undefined || v === null) return undefined
    if (!isObj(v)) {
      this.add(path, `${path} must be an object`)
      return undefined
    }
    return v
  }

  text(parent: Obj | undefined, key: string, path: string, max: number) {
    const v = parent?.[key]
    if (v === undefined || v === null) return
    if (typeof v !== 'string') this.add(path, `${path} must be a string`)
    else if (v.length > max) this.add(path, `${path} must be at most ${max} characters (got ${v.length})`)
  }

  number(parent: Obj | undefined, key: string, path: string, rangeKey: string) {
    const v = parent?.[key]
    if (v === undefined || v === null) return
    const [min, max] = NUMBER_RANGES[rangeKey]
    if (typeof v !== 'number' || !Number.isFinite(v)) this.add(path, `${path} must be a number`)
    else if (v < min || v > max) this.add(path, `${path} must be between ${min} and ${max}`)
  }

  bool(parent: Obj | undefined, key: string, path: string) {
    const v = parent?.[key]
    if (v !== undefined && v !== null && typeof v !== 'boolean') this.add(path, `${path} must be true or false`)
  }

  oneOf(parent: Obj | undefined, key: string, path: string, enumKey: string) {
    const v = parent?.[key]
    if (v === undefined || v === null) return
    const allowed = ENUMS[enumKey]
    if (typeof v !== 'string' || !allowed.includes(v)) this.add(path, `${path} must be one of: ${allowed.join(', ')}`)
  }

  date(parent: Obj | undefined, key: string, path: string) {
    const v = parent?.[key]
    if (v === undefined || v === null || v === '') return
    if (typeof v !== 'string' || !parseIsoDate(v)) this.add(path, `${path} must be a valid date in YYYY-MM-DD format`)
  }
}

/** Accepts both a bare certificate object and the web app's "Export JSON" file. */
export function unwrapCertificate(raw: unknown): Obj {
  if (!isObj(raw)) throw validationError([{ field: '', message: 'The request body must be a JSON object' }])
  if (raw.format === EXPORT_FORMAT && isObj(raw.config)) return raw.config
  return raw
}

/**
 * Validate an API request and turn it into a CertificateConfig — the same
 * data model the web application uses. Collects every problem it finds and
 * throws a single ValidationError listing them.
 *
 * Request shape (all sections optional except where noted):
 *   template | templateId, institution{name*}, participant{name*}, event{name*},
 *   body (or top-level "description") = wording with {{placeholders}},
 *   title, titleTagline, issueDate, eventGraphic, background, signatories[], design
 */
export async function parseCertificateRequest(raw: unknown, decodeImage: ImageDecoder, pathPrefix = ''): Promise<CertificateConfig> {
  const r = unwrapCertificate(raw)
  const c = new Checker()
  const p = (s: string) => pathPrefix + s

  // Template
  const templateId = r.template ?? r.templateId
  const templateIds = TEMPLATES.map((t) => t.id)
  if (templateId !== undefined && (typeof templateId !== 'string' || !templateIds.includes(templateId)))
    c.add(p('template'), `template must be one of: ${templateIds.join(', ')}`)

  // Text sections
  const sections: Array<[string, keyof typeof TEXT_LIMITS]> = [
    ['institution', 'institution'],
    ['participant', 'participant'],
    ['event', 'event'],
  ]
  const objs: Record<string, Obj | undefined> = {}
  for (const [key, limits] of sections) {
    const o = c.obj(r, key, p(key))
    objs[key] = o
    for (const [k, max] of Object.entries(TEXT_LIMITS[limits])) c.text(o, k, p(`${key}.${k}`), max)
  }
  c.date(objs.event, 'startDate', p('event.startDate'))
  c.date(objs.event, 'endDate', p('event.endDate'))
  c.date(r, 'issueDate', p('issueDate'))
  c.number(objs.institution, 'logoSize', p('institution.logoSize'), 'institution.logoSize')
  c.text(r, 'title', p('title'), 120)
  c.text(r, 'titleTagline', p('titleTagline'), 120)

  // Wording: "body", or "description" at the top level as an alias.
  const body = r.body !== undefined ? r.body : typeof r.description === 'string' ? r.description : undefined
  if (body !== undefined && body !== null) {
    if (typeof body !== 'string') c.add(p('body'), 'body must be a string')
    else if (body.length > API_LIMITS.maxBodyChars)
      c.add(p('body'), `body must be at most ${API_LIMITS.maxBodyChars} characters (got ${body.length})`)
  }

  // Graphics
  const graphic = c.obj(r, 'eventGraphic', p('eventGraphic'))
  c.oneOf(graphic, 'placement', p('eventGraphic.placement'), 'eventGraphic.placement')
  c.number(graphic, 'size', p('eventGraphic.size'), 'eventGraphic.size')
  c.number(graphic, 'opacity', p('eventGraphic.opacity'), 'eventGraphic.opacity')
  const background = c.obj(r, 'background', p('background'))
  c.number(background, 'fade', p('background.fade'), 'background.fade')

  // Design
  const design = c.obj(r, 'design', p('design'))
  for (const k of ['primaryFont', 'secondaryFont', 'displayFont', 'bodyAlign', 'borderStyle', 'signatureLayout', 'dateFormat'])
    c.oneOf(design, k, p(`design.${k}`), `design.${k}`)
  for (const k of ['bodyFontSize', 'headingFontSize', 'titleFontSize', 'borderWidth']) c.number(design, k, p(`design.${k}`), `design.${k}`)
  for (const k of COLORS) {
    const v = design?.[k]
    if (v !== undefined && v !== null && (typeof v !== 'string' || !normalizeHex(v)))
      c.add(p(`design.${k}`), `design.${k} must be a hex colour such as #262A6B`)
  }
  c.bool(design, 'showSignatureLines', p('design.showSignatureLines'))

  // Signatories
  let signatories: Obj[] = []
  if (r.signatories !== undefined && r.signatories !== null) {
    if (!Array.isArray(r.signatories)) c.add(p('signatories'), 'signatories must be an array')
    else if (r.signatories.length > MAX_SIGNATORIES)
      c.add(p('signatories'), `At most ${MAX_SIGNATORIES} signatories are supported (got ${r.signatories.length})`)
    else
      r.signatories.forEach((s, i) => {
        const path = p(`signatories[${i}]`)
        if (!isObj(s)) return c.add(path, `${path} must be an object`)
        for (const [k, max] of Object.entries(TEXT_LIMITS.signatory)) c.text(s, k, `${path}.${k}`, max)
        c.bool(s, 'showSignature', `${path}.showSignature`)
        for (const k of ['signatureScale', 'signatureOffsetX', 'signatureOffsetY']) c.number(s, k, `${path}.${k}`, `signatory.${k}`)
        signatories.push(s)
      })
  }

  // Images — decoded only if everything else is structurally valid enough.
  const decode = async (value: unknown, field: string): Promise<ImageAsset | null> => {
    try {
      return await decodeImage(value, field)
    } catch (e) {
      if (e instanceof FieldError) {
        c.add(e.field, e.message)
        if (e.status === 413) c.tooLarge ??= e.message
        return null
      }
      throw e
    }
  }
  const [logo, graphicImage, backgroundImage, ...signatures] = await Promise.all([
    decode(objs.institution?.logo, p('institution.logo')),
    decode(graphic?.image, p('eventGraphic.image')),
    decode(background?.image, p('background.image')),
    ...signatories.map((s, i) => decode(s.signature, p(`signatories[${i}].signature`))),
  ])

  if (c.tooLarge) throw new ApiError(413, 'PayloadTooLarge', c.tooLarge, c.issues)
  if (c.issues.length) throw validationError(c.issues)

  // Hand the cleaned-up request to the app's own normaliser so defaults and
  // template design are applied exactly as in the web application.
  signatories = signatories.map((s, i) => ({ ...s, signature: signatures[i] }))
  const cfg = normalizeConfig({
    ...r,
    templateId: typeof templateId === 'string' ? templateId : 'reference',
    body: body ?? undefined,
    institution: { ...objs.institution, logo },
    participant: objs.participant ?? {},
    event: objs.event ?? {},
    eventGraphic: { ...graphic, image: graphicImage },
    background: { ...background, image: backgroundImage },
    signatories,
  })

  // Business rules shared with the web form (required fields, date range, wording syntax…).
  const issues = exportErrors(cfg).map((e) => {
    const field = p(apiPath(e.field, cfg))
    const message = /is required\.$/.test(e.message) || /needs a name/.test(e.message) ? `${field} is required` : `${field}: ${e.message.replace(/\.$/, '')}`
    return { field, message }
  })
  if (issues.length) throw validationError(issues)
  return cfg
}
