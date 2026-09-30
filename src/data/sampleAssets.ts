import { loadFont } from '../lib/fonts/loader'
import { cssFamilyFor } from '../lib/fonts/registry'
import { svgToAsset } from '../lib/images'
import type { ImageAsset } from '../types/certificate'
import { newId } from '../utils/dataUrl'

/** A generic placeholder crest (clearly marked SAMPLE) — replace it with your own logo. */
const SAMPLE_CREST = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 224">
  <g fill="none" stroke="#1a1a1a" stroke-linejoin="round" stroke-linecap="round">
    <path d="M100 10 L176 30 L176 98 C176 146 144 176 100 194 C56 176 24 146 24 98 L24 30 Z" fill="#fff" stroke-width="5"/>
    <path d="M100 20 L166 37 L166 98 C166 140 138 166 100 182 C62 166 34 140 34 98 L34 37 Z" stroke-width="1.6"/>
    <path d="M34 100 H166 M100 21 V182" stroke-width="2.4"/>
    <!-- gear -->
    <g transform="translate(67 66)" stroke-width="2.4">
      <circle r="15"/><circle r="6"/>
      <path d="M0 -21 V-15 M0 15 V21 M-21 0 H-15 M15 0 H21 M-14.8 -14.8 L-10.6 -10.6 M10.6 10.6 L14.8 14.8 M-14.8 14.8 L-10.6 10.6 M10.6 -10.6 L14.8 -14.8"/>
    </g>
    <!-- lamp of knowledge -->
    <g transform="translate(133 70)" stroke-width="2.4">
      <path d="M-20 10 C-10 18 12 18 22 8 L12 8 C10 2 -8 2 -12 8 Z"/>
      <path d="M-4 3 C-10 -8 2 -14 0 -26 C10 -16 8 -6 3 3"/>
    </g>
    <!-- open book -->
    <g transform="translate(100 138)" stroke-width="2.4">
      <path d="M0 -14 C-14 -22 -32 -22 -44 -16 V16 C-32 10 -14 10 0 18 C14 10 32 10 44 16 V-16 C32 -22 14 -22 0 -14 Z" fill="#fff"/>
      <path d="M0 -14 V18 M-36 -8 C-26 -12 -14 -12 -8 -8 M-36 0 C-26 -4 -14 -4 -8 0 M36 -8 C26 -12 14 -12 8 -8 M36 0 C26 -4 14 -4 8 0" stroke-width="1.5"/>
    </g>
    <!-- ribbon -->
    <path d="M18 190 L40 184 L160 184 L182 190 L172 204 L182 218 L150 212 L50 212 L18 218 L28 204 Z" fill="#fff" stroke-width="2.4"/>
  </g>
  <text x="100" y="204" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="3" fill="#1a1a1a">SAMPLE</text>
</svg>`

export async function sampleLogo(): Promise<ImageAsset> {
  return svgToAsset(SAMPLE_CREST, 'sample-crest.png', 900, 'Sample institution crest')
}

/** Script font the sample signatures are drawn with. */
export const SIGNATURE_FONT = 'great-vibes-400-normal.ttf'

/**
 * Sample handwritten signatures rendered from the bundled script font in a
 * blue-black ink, trimmed and on a transparent background — like a real
 * scanned signature PNG.
 */
export async function sampleSignature(text: string, seed: number): Promise<ImageAsset> {
  await loadFont(SIGNATURE_FONT)
  const size = 120
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 260
  const ctx = canvas.getContext('2d')!
  ctx.font = `${size}px "${cssFamilyFor(SIGNATURE_FONT)}"`
  ctx.fillStyle = '#1B2F7A'
  ctx.translate(40, 180)
  ctx.rotate(-0.05 - (seed % 3) * 0.02)
  ctx.fillText(text, 0, 0)
  // A quick underline flourish.
  const w = ctx.measureText(text).width
  ctx.strokeStyle = '#1B2F7A'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(w * 0.15, 30)
  ctx.bezierCurveTo(w * 0.45, 18 + seed * 3, w * 0.7, 44, w * 1.02, 14)
  ctx.stroke()
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Trim to content.
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let l = canvas.width
  let r = 0
  let t = canvas.height
  let b = 0
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++)
      if (px[(y * canvas.width + x) * 4 + 3] > 8) {
        l = Math.min(l, x)
        r = Math.max(r, x)
        t = Math.min(t, y)
        b = Math.max(b, y)
      }
  const out = document.createElement('canvas')
  out.width = r - l + 9
  out.height = b - t + 9
  out.getContext('2d')!.drawImage(canvas, l - 4, t - 4, out.width, out.height, 0, 0, out.width, out.height)
  return {
    id: newId(),
    dataUrl: out.toDataURL('image/png'),
    mime: 'image/png',
    width: out.width,
    height: out.height,
    name: `sample-signature-${seed + 1}.png`,
    alt: `Sample signature ${seed + 1}`,
  }
}
