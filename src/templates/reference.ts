import { A4_LANDSCAPE } from '../lib/layout/displayList.js'
import type { TemplateDefinition } from './types.js'

/**
 * "Institutional" — modelled on the supplied reference certificate
 * (LaTeX-typeset, A4 landscape, Computer Modern throughout):
 *
 *  • institution name in upper case, deep magenta, ~19pt, centred at ~13% height
 *  • address/subtitle directly below in the same colour and size
 *  • crest centred below (~70pt tall)
 *  • bold navy "CERTIFICATE" at ~40% height
 *  • a single justified paragraph at 14.4pt with generous leading (≈1.7),
 *    the participant's name in bold-italic navy capitals and the affiliation italic
 *  • signatories evenly spread along the bottom, signature above name above designation,
 *    no rules, no border.
 */
export const referenceTemplate: TemplateDefinition = {
  id: 'reference',
  name: 'Institutional (reference)',
  description: 'Clean LaTeX-style certificate with centred heading, crest and justified text — based on your reference.',
  layout: {
    page: A4_LANDSCAPE,
    margin: { top: 62, right: 42, bottom: 74, left: 42 },
    borderInset: 16,
    headerOrder: ['heading', 'subtitle', 'department', 'logo', 'graphic', 'title'],
    heading: { font: 'primary', color: 'heading', uppercase: true, lineHeight: 1.25, maxLines: 2, gapAfter: 2 },
    subtitle: { scale: 1, font: 'primary', color: 'heading', gapAfter: 16 },
    department: { scale: 0.78, font: 'primary', color: 'heading', gapAfter: 12 },
    logo: { gapAfter: 16, maxWidthRatio: 0.3 },
    graphicAboveTitle: { gapAfter: 10 },
    title: { font: 'primary', color: 'accent', bold: true, uppercase: true, gapAfter: 10 },
    tagline: { scale: 0.7, font: 'primary', color: 'accent', italic: true, gapAfter: 8 },
    body: {
      lineHeight: 1.7,
      gapBefore: 16,
      minGapToSignatures: 16,
      vAlign: 'top',
      minSize: 10,
      widthRatio: 1,
      displayScale: 1.8,
      displayBold: true,
    },
    signatures: {
      imageHeight: 46,
      sidePadding: -18,
      nameScale: 1,
      nameBold: false,
      detailScale: 1,
      lineHeight: 1.6,
      rowGap: 12,
      lineMaxWidth: 150,
      gapBelowImage: 2,
    },
  },
  defaults: {
    title: 'Certificate',
    titleTagline: '',
    logoSize: 70,
    graphicSize: 64,
    body:
      'This is to certify that ***{{salutation}} {{name|upper}},*** *{{affiliation}}* has participated in ' +
      '{{#event_type}}the {{event_type}} on {{/event_type}}“{{event_name}}”' +
      '{{#description}}, {{description}}{{/description}}' +
      '{{#organizer}}, organized by {{organizer}}{{/organizer}}' +
      '{{#venue}}, held at {{venue}}{{/venue}} {{date_range}}.',
    design: {
      primaryFont: 'cmu-serif',
      secondaryFont: 'cmu-serif',
      displayFont: 'cmu-serif',
      headingColor: '#8E1F57',
      accentColor: '#262A6B',
      textColor: '#1C1C1E',
      bodyAlign: 'justify',
      bodyFontSize: 14.4,
      headingFontSize: 19,
      titleFontSize: 16.4,
      borderStyle: 'none',
      borderColor: '#262A6B',
      borderWidth: 1.5,
      backgroundColor: '#FFFFFF',
      signatureLayout: 'auto',
      showSignatureLines: false,
      dateFormat: 'Do^ MMM YYYY',
    },
  },
}
