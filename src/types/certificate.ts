/**
 * Certificate data model. Everything the user can configure lives in a single
 * serialisable `CertificateConfig` object, which is what gets saved, exported
 * and imported as JSON.
 */

/** A raster image stored inline. SVG/WebP uploads are rasterised to PNG on upload. */
export interface ImageAsset {
  id: string
  /** data:image/png;base64,… or data:image/jpeg;base64,… */
  dataUrl: string
  mime: 'image/png' | 'image/jpeg'
  /** Intrinsic pixel dimensions — used to preserve aspect ratio. */
  width: number
  height: number
  /** Original file name (for display). */
  name: string
  alt: string
}

export interface Signatory {
  id: string
  name: string
  designation: string
  organization: string
  signature: ImageAsset | null
  showSignature: boolean
  /** Multiplier on the template's signature box size (0.5 – 1.6). */
  signatureScale: number
  /** Nudge in points (pt). Positive X moves right, positive Y moves down. */
  signatureOffsetX: number
  signatureOffsetY: number
}

export type EventGraphicPlacement =
  | 'top-left'
  | 'top-right'
  | 'above-title'
  | 'watermark'

export type BorderStyle = 'none' | 'single' | 'double' | 'thick-thin' | 'ornate'

export type TextAlign = 'justify' | 'center' | 'left'

export type SignatureLayout = 'auto' | 'one-row' | 'two-rows'

export type DateFormatId =
  | 'D MMMM YYYY'
  | 'Do MMMM YYYY'
  | 'Do^ MMMM YYYY'
  | 'Do^ MMM YYYY'
  | 'D MMM YYYY'
  | 'MMMM D, YYYY'
  | 'DD/MM/YYYY'
  | 'DD-MM-YYYY'
  | 'DD.MM.YYYY'

export interface DesignSettings {
  /** Font family id (see lib/fonts/registry) for headings, title. */
  primaryFont: string
  /** Font family id for body text & signatories. */
  secondaryFont: string
  /** Font family id for "display" lines (lines starting with `# ` in the body). */
  displayFont: string
  headingColor: string
  accentColor: string
  textColor: string
  bodyAlign: TextAlign
  /** Body text size in pt. The engine shrinks it automatically if text overflows. */
  bodyFontSize: number
  /** Heading (institution name) size in pt. */
  headingFontSize: number
  titleFontSize: number
  borderStyle: BorderStyle
  borderColor: string
  /** Border thickness in pt. */
  borderWidth: number
  backgroundColor: string
  signatureLayout: SignatureLayout
  showSignatureLines: boolean
  dateFormat: DateFormatId
}

export interface CertificateConfig {
  version: 1
  templateId: string
  institution: {
    name: string
    subtitle: string
    department: string
    logo: ImageAsset | null
    /** Logo height in pt; width follows aspect ratio. */
    logoSize: number
  }
  /** Certificate title, e.g. "CERTIFICATE". */
  title: string
  /** Optional line under the title, e.g. "of Participation". */
  titleTagline: string
  participant: {
    salutation: string
    name: string
    designation: string
    department: string
    institution: string
  }
  event: {
    name: string
    type: string
    organizer: string
    venue: string
    /** ISO yyyy-mm-dd */
    startDate: string
    endDate: string
    description: string
  }
  /** Issue date for the {{date}} variable. ISO yyyy-mm-dd. */
  issueDate: string
  /** Certificate wording with {{variables}} and light markup. */
  body: string
  eventGraphic: {
    image: ImageAsset | null
    placement: EventGraphicPlacement
    /** Size (height) in pt for corner/above-title placements; watermark uses a fraction of the page. */
    size: number
    /** 0–1 */
    opacity: number
  }
  background: {
    image: ImageAsset | null
    /** 0–1, how strongly the background image is washed out towards white. */
    fade: number
  }
  signatories: Signatory[]
  design: DesignSettings
}

export const MAX_SIGNATORIES = 6
