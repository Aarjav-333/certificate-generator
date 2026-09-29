/**
 * Font registry. Every font is shipped as a static TTF in /public/fonts so the
 * exact same binary is used for measuring (fontkit), previewing (FontFace),
 * rasterising (canvas) and embedding in the PDF (pdf-lib). That is what keeps
 * the preview and the exported files identical.
 */

export interface FontVariantFile {
  weight: 400 | 700
  italic: boolean
  file: string
}

export interface FontFamilyDef {
  id: string
  label: string
  category: 'serif' | 'sans' | 'display' | 'script'
  variants: FontVariantFile[]
  /**
   * Whether pdf-lib can subset this font correctly. Verified per family: the
   * subsetter drops glyphs for some fonts, which are then embedded in full.
   */
  pdfSubset: boolean
}

const v = (
  slug: string,
  list: Array<[400 | 700, boolean, number?]>,
): FontVariantFile[] =>
  list.map(([weight, italic, fileWeight]) => ({
    weight,
    italic,
    file: `${slug}-${fileWeight ?? weight}-${italic ? 'italic' : 'normal'}.ttf`,
  }))

const ALL4: Array<[400 | 700, boolean]> = [
  [400, false],
  [700, false],
  [400, true],
  [700, true],
]

export const FONT_FAMILIES: FontFamilyDef[] = [
  {
    id: 'cmu-serif',
    label: 'Computer Modern (CMU Serif)',
    category: 'serif',
    pdfSubset: true,
    variants: v('cmu-serif', ALL4),
  },
  {
    id: 'eb-garamond',
    label: 'EB Garamond',
    category: 'serif',
    pdfSubset: false,
    variants: v('eb-garamond', ALL4),
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville',
    category: 'serif',
    pdfSubset: true,
    variants: v('libre-baskerville', [
      [400, false],
      [700, false],
      [400, true],
    ]),
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    category: 'display',
    pdfSubset: true,
    variants: v('playfair-display', ALL4),
  },
  {
    id: 'cinzel',
    label: 'Cinzel (capitals)',
    category: 'display',
    pdfSubset: true,
    variants: v('cinzel', [
      [400, false],
      [700, false],
    ]),
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    category: 'sans',
    pdfSubset: true,
    variants: v('montserrat', ALL4),
  },
  {
    id: 'great-vibes',
    label: 'Great Vibes (script)',
    category: 'script',
    pdfSubset: false,
    variants: v('great-vibes', [[400, false]]),
  },
]

export const DEFAULT_FONT_ID = 'cmu-serif'

export function getFamily(id: string): FontFamilyDef {
  return FONT_FAMILIES.find((f) => f.id === id) ?? FONT_FAMILIES[0]
}

/** A resolved font face — one concrete TTF file. */
export type FontKey = string

/**
 * Pick the closest available variant: exact match, then same style with any
 * weight, then same weight upright, then the regular face.
 */
export function resolveFont(
  familyId: string,
  bold: boolean,
  italic: boolean,
): FontKey {
  const fam = getFamily(familyId)
  const weight = bold ? 700 : 400
  const pick =
    fam.variants.find((x) => x.weight === weight && x.italic === italic) ??
    fam.variants.find((x) => x.italic === italic) ??
    fam.variants.find((x) => x.weight === weight && !x.italic) ??
    fam.variants[0]
  return pick.file
}

export function familyOfFont(key: FontKey): FontFamilyDef | undefined {
  return FONT_FAMILIES.find((f) => f.variants.some((v) => v.file === key))
}

export function fontUrl(key: FontKey): string {
  return `${import.meta.env.BASE_URL}fonts/${key}`
}

/** CSS family name under which a given file is registered with the FontFace API. */
export function cssFamilyFor(key: FontKey): string {
  return `cg_${key.replace(/\.ttf$/, '').replace(/[^a-z0-9]/gi, '_')}`
}
