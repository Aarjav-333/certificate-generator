import type { CertificateActions } from '../../hooks/useCertificate'
import { processImageFile } from '../../lib/images'
import { errorFor, type FieldError } from '../../lib/validation'
import { signatureRows } from '../../templates/engine'
import { MAX_SIGNATORIES, type CertificateConfig, type Signatory } from '../../types/certificate'
import { ImageUpload } from '../ui/ImageUpload'
import { Button, Field, Grid, Range, TextInput, Toggle } from '../ui/primitives'

interface Props {
  config: CertificateConfig
  actions: CertificateActions
  errors: FieldError[]
}

export function SignatoriesSection({ config, actions, errors }: Props) {
  const list = config.signatories
  const rows = signatureRows(list.length, config.design.signatureLayout)
  return (
    <>
      <p className="text-xs text-stone-600" aria-live="polite">
        {list.length === 0
          ? 'No signatories — the signature area is left out.'
          : `${list.length} signator${list.length === 1 ? 'y' : 'ies'} · ${rows.length === 1 ? 'one row' : `two rows (${rows.join(' + ')})`}. Change the arrangement under Design.`}
      </p>
      <ol className="space-y-3">
        {list.map((s, i) => (
          <SignatoryCard
            key={s.id}
            s={s}
            index={i}
            count={list.length}
            actions={actions}
            nameError={errorFor(errors, `sig-${s.id}-name`)}
          />
        ))}
      </ol>
      <Button onClick={actions.addSignatory} disabled={list.length >= MAX_SIGNATORIES} className="w-full">
        + Add signatory {list.length >= MAX_SIGNATORIES && `(maximum ${MAX_SIGNATORIES})`}
      </Button>
    </>
  )
}

function SignatoryCard({
  s,
  index,
  count,
  actions,
  nameError,
}: {
  s: Signatory
  index: number
  count: number
  actions: CertificateActions
  nameError?: string
}) {
  const up = (v: Partial<Signatory>) => actions.signatory(s.id, v)
  const label = `Signatory ${index + 1}`
  return (
    <li className="rounded-md border border-stone-200 bg-stone-50/60 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-800">{label}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => actions.moveSignatory(s.id, -1)} disabled={index === 0} aria-label={`Move ${label} left`}>
            ←
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.moveSignatory(s.id, 1)} disabled={index === count - 1} aria-label={`Move ${label} right`}>
            →
          </Button>
          <Button size="sm" variant="danger" onClick={() => actions.removeSignatory(s.id)} aria-label={`Remove ${label}`}>
            Remove
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <Grid>
          <Field id={`sig-${s.id}-name`} label="Name" required error={nameError}>
            <TextInput id={`sig-${s.id}-name`} value={s.name} invalid={Boolean(nameError)} onChange={(e) => up({ name: e.target.value })} />
          </Field>
          <Field id={`sig-${s.id}-designation`} label="Designation">
            <TextInput id={`sig-${s.id}-designation`} value={s.designation} onChange={(e) => up({ designation: e.target.value })} />
          </Field>
        </Grid>
        <Field id={`sig-${s.id}-org`} label="Organization / department" hint="Optional third line">
          <TextInput id={`sig-${s.id}-org`} value={s.organization} onChange={(e) => up({ organization: e.target.value })} />
        </Field>
        <ImageUpload
          label="Signature image"
          kind="signature"
          value={s.signature}
          onChange={(signature) => up({ signature, showSignature: true })}
          options={{ trim: true }}
          hint="Transparent PNG works best. Margins are trimmed automatically."
          withAlt={false}
          compact
        />
        {s.signature && (
          <div className="space-y-3 rounded-md border border-stone-200 bg-white p-3">
            <Toggle label="Show signature on the certificate" checked={s.showSignature} onChange={(showSignature) => up({ showSignature })} />
            <ScannedWhiteRemoval s={s} onChange={up} />
            <Range
              id={`sig-${s.id}-scale`}
              label="Signature size"
              value={s.signatureScale}
              min={0.4}
              max={1.8}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(signatureScale) => up({ signatureScale })}
            />
            <Grid>
              <Range
                id={`sig-${s.id}-x`}
                label="Horizontal position"
                value={s.signatureOffsetX}
                min={-60}
                max={60}
                step={1}
                unit=" pt"
                onChange={(signatureOffsetX) => up({ signatureOffsetX })}
              />
              <Range
                id={`sig-${s.id}-y`}
                label="Vertical position"
                value={s.signatureOffsetY}
                min={-30}
                max={30}
                step={1}
                unit=" pt"
                onChange={(signatureOffsetY) => up({ signatureOffsetY })}
              />
            </Grid>
            {(s.signatureOffsetX !== 0 || s.signatureOffsetY !== 0 || s.signatureScale !== 1) && (
              <Button size="sm" variant="ghost" onClick={() => up({ signatureOffsetX: 0, signatureOffsetY: 0, signatureScale: 1 })}>
                Reset size & position
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/** Re-process a photographed/scanned signature so its paper background becomes transparent. */
function ScannedWhiteRemoval({ s, onChange }: { s: Signatory; onChange: (v: Partial<Signatory>) => void }) {
  if (!s.signature || s.signature.mime !== 'image/jpeg') return null
  async function run() {
    if (!s.signature) return
    const blob = await (await fetch(s.signature.dataUrl)).blob()
    const file = new File([blob], s.signature.name, { type: 'image/jpeg' })
    onChange({ signature: await processImageFile(file, 'signature', { removeWhite: true, trim: true }) })
  }
  return (
    <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">
      This signature is a photo or scan with a solid background.{' '}
      <button type="button" className="font-medium underline underline-offset-2" onClick={() => void run()}>
        Remove the white background
      </button>
    </p>
  )
}
