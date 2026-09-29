import { A4_LANDSCAPE } from '../lib/layout/displayList'
import type { TemplateDefinition } from './types'

/** Classic engraved look: ornate gold frame, Cinzel capitals, script name line. */
export const classicTemplate: TemplateDefinition = {
  id: 'classic',
  name: 'Classic',
  description: 'Ornate frame, engraved capitals and a script name line.',
  layout: {
    page: A4_LANDSCAPE,
    margin: { top: 60, right: 78, bottom: 60, left: 78 },
    borderInset: 18,
    headerOrder: ['logo', 'heading', 'subtitle', 'department', 'graphic', 'title'],
    heading: { font: 'primary', color: 'heading', bold: true, uppercase: true, letterSpacing: 0.05, lineHeight: 1.2, maxLines: 2, gapAfter: 0 },
    subtitle: { scale: 0.68, font: 'secondary', color: 'text', italic: true, gapAfter: 2 },
    department: { scale: 0.56, font: 'primary', color: 'heading', uppercase: true, letterSpacing: 0.08, gapAfter: 4 },
    logo: { gapAfter: 6, maxWidthRatio: 0.25 },
    graphicAboveTitle: { gapAfter: 4 },
    title: { font: 'primary', color: 'accent', bold: true, uppercase: true, letterSpacing: 0.14, gapAfter: 8 },
    tagline: { scale: 0.46, font: 'secondary', color: 'heading', italic: true, gapAfter: 4 },
    body: {
      lineHeight: 1.5,
      gapBefore: 2,
      minGapToSignatures: 8,
      vAlign: 'center',
      minSize: 10,
      widthRatio: 0.9,
      displayScale: 2.5,
    },
    signatures: {
      imageHeight: 40,
      sidePadding: 20,
      nameScale: 0.92,
      nameBold: true,
      detailScale: 0.84,
      lineHeight: 1.4,
      rowGap: 10,
      lineMaxWidth: 150,
      gapBelowImage: 3,
    },
  },
  defaults: {
    title: 'Certificate',
    titleTagline: 'of Participation',
    logoSize: 58,
    graphicSize: 56,
    body:
      'This certificate is proudly presented to\n' +
      '# {{salutation}} {{name}}\n' +
      '*{{affiliation}}*\n' +
      'for participating in {{#event_type}}the {{event_type}} {{/event_type}}**“{{event_name}}”**' +
      '{{#organizer}} organized by {{organizer}}{{/organizer}}{{#venue}} at {{venue}}{{/venue}} {{date_range}}.' +
      '{{#description}} {{description}}{{/description}}',
    design: {
      primaryFont: 'cinzel',
      secondaryFont: 'eb-garamond',
      displayFont: 'great-vibes',
      headingColor: '#1C2B4A',
      accentColor: '#9A7424',
      textColor: '#2A2A2A',
      bodyAlign: 'center',
      bodyFontSize: 15.5,
      headingFontSize: 19,
      titleFontSize: 34,
      borderStyle: 'ornate',
      borderColor: '#9A7424',
      borderWidth: 2,
      backgroundColor: '#FFFDF7',
      signatureLayout: 'auto',
      showSignatureLines: true,
      dateFormat: 'Do MMMM YYYY',
    },
  },
}
