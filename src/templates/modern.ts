import { A4_LANDSCAPE } from '../lib/layout/displayList.js'
import type { TemplateDefinition } from './types.js'

/** Modern minimal: accent bands, tracked sans-serif labels and a large serif title. */
export const modernTemplate: TemplateDefinition = {
  id: 'modern',
  name: 'Modern',
  description: 'Minimal layout with accent bands, tracked sans labels and a serif display title.',
  layout: {
    page: A4_LANDSCAPE,
    margin: { top: 50, right: 80, bottom: 56, left: 80 },
    borderInset: 26,
    headerOrder: ['logo', 'heading', 'subtitle', 'department', 'graphic', 'title'],
    heading: { font: 'primary', color: 'accent', bold: true, uppercase: true, letterSpacing: 0.16, lineHeight: 1.3, maxLines: 2, gapAfter: 1 },
    subtitle: { scale: 0.82, font: 'primary', color: 'text', letterSpacing: 0.04, gapAfter: 1 },
    department: { scale: 0.82, font: 'primary', color: 'text', letterSpacing: 0.04, gapAfter: 4 },
    logo: { gapAfter: 8, maxWidthRatio: 0.25 },
    graphicAboveTitle: { gapAfter: 6 },
    title: { font: 'display', color: 'heading', bold: true, gapAfter: 8 },
    tagline: { scale: 0.3, font: 'primary', color: 'accent', uppercase: true, letterSpacing: 0.3, gapAfter: 4 },
    body: {
      lineHeight: 1.55,
      gapBefore: 4,
      minGapToSignatures: 8,
      vAlign: 'center',
      minSize: 10,
      widthRatio: 0.88,
      displayScale: 2.1,
      displayBold: true,
    },
    signatures: {
      imageHeight: 40,
      sidePadding: 10,
      nameScale: 0.88,
      nameBold: true,
      detailScale: 0.78,
      lineHeight: 1.45,
      rowGap: 10,
      lineMaxWidth: 140,
      gapBelowImage: 3,
    },
  },
  defaults: {
    title: 'Certificate',
    titleTagline: 'of Participation',
    logoSize: 50,
    graphicSize: 56,
    body:
      'This certificate is presented to\n' +
      '# *{{salutation}} {{name}}*\n' +
      '{{affiliation}}\n' +
      'in recognition of participation in {{#event_type}}the {{event_type}} {{/event_type}}**{{event_name}}**' +
      '{{#organizer}}, organized by {{organizer}}{{/organizer}}{{#venue}} at {{venue}}{{/venue}}, {{date_range}}.' +
      '{{#description}} {{description}}{{/description}}',
    design: {
      primaryFont: 'montserrat',
      secondaryFont: 'eb-garamond',
      displayFont: 'playfair-display',
      headingColor: '#14202B',
      accentColor: '#0F5C6E',
      textColor: '#1F2328',
      bodyAlign: 'center',
      bodyFontSize: 15,
      headingFontSize: 12.5,
      titleFontSize: 42,
      borderStyle: 'none',
      borderColor: '#0F5C6E',
      borderWidth: 1,
      backgroundColor: '#FFFFFF',
      signatureLayout: 'auto',
      showSignatureLines: true,
      dateFormat: 'D MMMM YYYY',
    },
  },
  decorate: ({ page, design }) => [
    { kind: 'rect', x: 0, y: 0, w: page.width, h: 12, fill: design.accentColor },
    { kind: 'rect', x: 0, y: 16, w: page.width, h: 1.2, fill: design.accentColor },
    { kind: 'rect', x: 0, y: page.height - 8, w: page.width, h: 8, fill: design.accentColor },
  ],
}
