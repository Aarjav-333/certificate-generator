import { memo, type CSSProperties } from 'react'
import { cssFamilyFor } from '../fonts/registry'
import type { CertificateLayout, Prim } from '../layout/displayList'

/** No browser kerning/ligatures: every character is placed at the engine's x position. */
const TEXT_STYLE: CSSProperties = {
  fontKerning: 'none',
  fontVariantLigatures: 'none',
  fontFeatureSettings: '"liga" 0, "clig" 0, "calt" 0, "dlig" 0',
  whiteSpace: 'pre',
}

function renderPrim(p: Prim, i: number) {
  switch (p.kind) {
    case 'text':
      return (
        <text key={i} x={p.xs.map((x) => +x.toFixed(3)).join(' ')} y={p.y} fontFamily={cssFamilyFor(p.font)} fontSize={p.size} fill={p.color} style={TEXT_STYLE}>
          {p.text}
        </text>
      )
    case 'rect':
      return (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={p.fill ?? 'none'}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          opacity={p.opacity}
        />
      )
    case 'line':
      return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.width} />
    case 'path':
      return (
        <path
          key={i}
          d={p.d}
          transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}
          fill={p.fill ?? 'none'}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
        />
      )
    case 'image':
      return (
        <image
          key={i}
          href={p.src}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          opacity={p.opacity}
          preserveAspectRatio="none"
          aria-label={p.alt}
        />
      )
  }
}

interface Props {
  layout: CertificateLayout
  title: string
  className?: string
}

/** Live preview: the display list drawn as SVG in page points. */
export const CertificateSvg = memo(function CertificateSvg({ layout, title, className }: Props) {
  const { width, height } = layout.page
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={title}
      textRendering="geometricPrecision"
    >
      <defs>
        <clipPath id="cert-page">
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>
      <g clipPath="url(#cert-page)">{layout.prims.map(renderPrim)}</g>
    </svg>
  )
})
