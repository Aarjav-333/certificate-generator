import type { PageSize, Prim } from '../lib/layout/displayList'
import type { DesignSettings } from '../types/certificate'

export type ColorRole = 'heading' | 'accent' | 'text'
export type FontRole = 'primary' | 'secondary' | 'display'

export interface LineSpec {
  /** Size relative to the heading size (for header lines) or body size. */
  scale: number
  font: FontRole
  color: ColorRole
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
  /** Tracking in em. */
  letterSpacing?: number
  /** Space below the line, in pt. */
  gapAfter: number
}

export type HeaderItem = 'logo' | 'heading' | 'subtitle' | 'department' | 'title' | 'graphic'

/**
 * Geometry and typographic rules of a certificate template. Every value is in
 * PDF points on the template's page. The same definition drives the preview
 * and all exports.
 */
export interface TemplateLayout {
  page: PageSize
  margin: { top: number; right: number; bottom: number; left: number }
  /** Inset of the decorative border from the page edge. */
  borderInset: number
  /** Order of the stacked header, top to bottom. */
  headerOrder: HeaderItem[]
  heading: Omit<LineSpec, 'scale'> & { lineHeight: number; maxLines: number }
  subtitle: LineSpec
  department: LineSpec
  logo: { gapAfter: number; maxWidthRatio: number }
  graphicAboveTitle: { gapAfter: number }
  title: Omit<LineSpec, 'scale'>
  tagline: LineSpec
  body: {
    lineHeight: number
    gapBefore: number
    minGapToSignatures: number
    vAlign: 'top' | 'center'
    minSize: number
    /** Fraction of the content width used by the body. */
    widthRatio: number
    displayScale: number
    displayBold?: boolean
  }
  signatures: {
    /** Height reserved for the handwritten signature, in pt. */
    imageHeight: number
    /** Horizontal padding of the signature strip from the content edges. */
    sidePadding: number
    nameScale: number
    nameBold: boolean
    detailScale: number
    lineHeight: number
    rowGap: number
    lineMaxWidth: number
    /** Gap between signature image and name. */
    gapBelowImage: number
  }
}

export interface TemplateDefaults {
  design: DesignSettings
  title: string
  titleTagline: string
  body: string
  logoSize: number
  graphicSize: number
}

export interface DecorateContext {
  page: PageSize
  design: DesignSettings
  layout: TemplateLayout
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  layout: TemplateLayout
  defaults: TemplateDefaults
  /** Optional template-specific decoration drawn behind content (above background). */
  decorate?: (ctx: DecorateContext) => Prim[]
}
