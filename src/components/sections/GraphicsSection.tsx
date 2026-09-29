import type { CertificateActions } from '../../hooks/useCertificate'
import type { CertificateConfig, EventGraphicPlacement } from '../../types/certificate'
import { ImageUpload } from '../ui/ImageUpload'
import { Field, Grid, Range, Select } from '../ui/primitives'

const PLACEMENTS: Array<{ id: EventGraphicPlacement; label: string }> = [
  { id: 'top-right', label: 'Top-right corner' },
  { id: 'top-left', label: 'Top-left corner' },
  { id: 'above-title', label: 'Centred, above the title' },
  { id: 'watermark', label: 'Watermark behind the text' },
]

export function GraphicsSection({ config, actions }: { config: CertificateConfig; actions: CertificateActions }) {
  const g = config.eventGraphic
  const bg = config.background
  return (
    <>
      <div className="space-y-3">
        <ImageUpload
          label="Event graphic / emblem"
          kind="graphic"
          value={g.image}
          onChange={(image) =>
            actions.eventGraphic({ image, opacity: image && g.placement === 'watermark' && g.opacity === 1 ? 0.12 : g.opacity })
          }
          hint="Optional. An event logo, emblem, badge or first-letter graphic — separate from the institution logo."
        />
        {g.image && (
          <>
            <Field id="graphic-placement" label="Placement">
              <Select
                id="graphic-placement"
                value={g.placement}
                onChange={(e) => {
                  const placement = e.target.value as EventGraphicPlacement
                  // Sensible opacity when switching to/from watermark.
                  const opacity = placement === 'watermark' ? (g.opacity === 1 ? 0.12 : g.opacity) : g.opacity < 0.5 ? 1 : g.opacity
                  actions.eventGraphic({ placement, opacity })
                }}
              >
                {PLACEMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Grid>
              <Range id="graphic-size" label="Size" value={g.size} min={24} max={160} step={1} unit=" pt" onChange={(size) => actions.eventGraphic({ size })} />
              <Range
                id="graphic-opacity"
                label="Opacity"
                value={g.opacity}
                min={0.04}
                max={1}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(opacity) => actions.eventGraphic({ opacity })}
              />
            </Grid>
          </>
        )}
      </div>
      <hr className="border-stone-200" />
      <div className="space-y-3">
        <ImageUpload
          label="Background image"
          kind="background"
          value={bg.image}
          onChange={(image) => actions.background({ image })}
          hint="Optional full-page photo (e.g. the campus). It is washed out so the text stays readable."
        />
        {bg.image && (
          <Range
            id="bg-fade"
            label="Wash-out"
            value={bg.fade}
            min={0}
            max={0.95}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(fade) => actions.background({ fade })}
          />
        )}
      </div>
    </>
  )
}
