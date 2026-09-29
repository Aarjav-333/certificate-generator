import type { CertificateActions } from '../../hooks/useCertificate'
import { FONT_FAMILIES } from '../../lib/fonts/registry'
import { BORDER_STYLES } from '../../templates/borders'
import type { BorderStyle, CertificateConfig, DateFormatId, SignatureLayout, TextAlign } from '../../types/certificate'
import { contrastRatio } from '../../utils/color'
import { DATE_FORMATS } from '../../utils/date'
import { ColorInput, Field, Grid, Range, Select, Toggle } from '../ui/primitives'

function FontSelect({ id, label, value, onChange, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field id={id} label={label} hint={hint}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {FONT_FAMILIES.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}

export function DesignSection({ config, actions }: { config: CertificateConfig; actions: CertificateActions }) {
  const d = config.design
  const set = actions.design
  const lowContrast = contrastRatio(d.textColor, d.backgroundColor) < 4.5
  return (
    <>
      <Grid cols={3}>
        <FontSelect id="font-primary" label="Primary font" hint="Heading & title" value={d.primaryFont} onChange={(primaryFont) => set({ primaryFont })} />
        <FontSelect id="font-secondary" label="Secondary font" hint="Body & signatories" value={d.secondaryFont} onChange={(secondaryFont) => set({ secondaryFont })} />
        <FontSelect id="font-display" label="Display font" hint="# display lines" value={d.displayFont} onChange={(displayFont) => set({ displayFont })} />
      </Grid>

      <Grid cols={3}>
        <Range id="size-heading" label="Heading size" value={d.headingFontSize} min={10} max={34} step={0.5} unit=" pt" onChange={(headingFontSize) => set({ headingFontSize })} />
        <Range id="size-title" label="Title size" value={d.titleFontSize} min={10} max={56} step={0.5} unit=" pt" onChange={(titleFontSize) => set({ titleFontSize })} />
        <Range id="size-body" label="Body size" value={d.bodyFontSize} min={9} max={24} step={0.1} unit=" pt" onChange={(bodyFontSize) => set({ bodyFontSize })} />
      </Grid>

      <Grid>
        <Field id="body-align" label="Text alignment">
          <Select id="body-align" value={d.bodyAlign} onChange={(e) => set({ bodyAlign: e.target.value as TextAlign })}>
            <option value="justify">Justified</option>
            <option value="center">Centred</option>
            <option value="left">Left</option>
          </Select>
        </Field>
        <Field id="date-format" label="Date format">
          <Select id="date-format" value={d.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as DateFormatId })}>
            {DATE_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      </Grid>

      <Grid cols={3}>
        <ColorInput id="color-heading" label="Heading colour" value={d.headingColor} onChange={(headingColor) => set({ headingColor })} />
        <ColorInput id="color-accent" label="Accent colour" value={d.accentColor} onChange={(accentColor) => set({ accentColor })} />
        <ColorInput id="color-text" label="Text colour" value={d.textColor} onChange={(textColor) => set({ textColor })} />
      </Grid>
      <p className="-mt-2 text-xs text-stone-500">Accent colours the title, bold text (such as the name) and display lines.</p>

      <Grid cols={3}>
        <ColorInput id="color-bg" label="Background" value={d.backgroundColor} onChange={(backgroundColor) => set({ backgroundColor })} />
        <Field id="border-style" label="Border">
          <Select id="border-style" value={d.borderStyle} onChange={(e) => set({ borderStyle: e.target.value as BorderStyle })}>
            {BORDER_STYLES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </Field>
        {d.borderStyle !== 'none' && (
          <ColorInput id="color-border" label="Border colour" value={d.borderColor} onChange={(borderColor) => set({ borderColor })} />
        )}
      </Grid>
      {d.borderStyle !== 'none' && (
        <Range id="border-width" label="Border thickness" value={d.borderWidth} min={0.5} max={6} step={0.25} unit=" pt" onChange={(borderWidth) => set({ borderWidth })} />
      )}
      {lowContrast && (
        <p className="text-xs text-amber-800" role="status">
          The text colour has low contrast against the background — it may be hard to read when printed.
        </p>
      )}

      <Grid>
        <Field id="sig-layout" label="Signature layout">
          <Select id="sig-layout" value={d.signatureLayout} onChange={(e) => set({ signatureLayout: e.target.value as SignatureLayout })}>
            <option value="auto">Automatic (1–4 in a row, 5–6 in two rows)</option>
            <option value="one-row">Always one row</option>
            <option value="two-rows">Two rows</option>
          </Select>
        </Field>
        <div className="flex items-end pb-1.5">
          <Toggle label="Draw signature lines" checked={d.showSignatureLines} onChange={(showSignatureLines) => set({ showSignatureLines })} />
        </div>
      </Grid>
    </>
  )
}
