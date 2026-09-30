import { useState } from 'react'
import type { CertificateLayout } from '../lib/layout/displayList'
import { CertificateSvg } from '../lib/render/svg'
import type { FieldError } from '../lib/validation'
import { Button } from './ui/primitives'

export type ExportKind = 'pdf' | 'png' | 'jpg' | 'print'

interface Props {
  layout: CertificateLayout | null
  loading: boolean
  renderError: string | null
  /** An automatic retry of the failed render is already scheduled. */
  retrying: boolean
  onRetry: () => void
  title: string
  errors: FieldError[]
  onExport: (kind: ExportKind) => Promise<void>
  onFocusField: (field: string) => void
}

export function PreviewPanel({ layout, loading, renderError, retrying, onRetry, title, errors, onExport, onFocusField }: Props) {
  const [busy, setBusy] = useState<ExportKind | null>(null)

  async function run(kind: ExportKind) {
    setBusy(kind)
    try {
      await onExport(kind)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="preview-heading" className="text-[15px] font-semibold text-stone-900">
            Preview
          </h2>
          <p className="text-xs text-stone-500">A4 landscape · 297 × 210 mm · exports match this preview exactly</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="primary" onClick={() => void run('pdf')} disabled={!layout || busy !== null}>
            {busy === 'pdf' ? 'Generating…' : 'Download PDF'}
          </Button>
          <Button onClick={() => void run('png')} disabled={!layout || busy !== null} title="300 DPI · 3508 × 2480 px">
            {busy === 'png' ? 'Rendering…' : 'PNG'}
          </Button>
          <Button onClick={() => void run('jpg')} disabled={!layout || busy !== null} title="300 DPI · 3508 × 2480 px">
            {busy === 'jpg' ? 'Rendering…' : 'JPG'}
          </Button>
          <Button onClick={() => void run('print')} disabled={!layout || busy !== null}>
            Print
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Please fix the following before generating:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {errors.map((e) => (
              <li key={e.field + e.message}>
                <button type="button" className="text-left underline underline-offset-2" onClick={() => onFocusField(e.field)}>
                  {e.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative">
        <div className="overflow-hidden rounded-sm bg-white shadow-[0_1px_3px_rgba(0,0,0,.12),0_8px_24px_rgba(0,0,0,.08)] ring-1 ring-stone-900/5">
          {layout ? (
            <CertificateSvg layout={layout} title={title} className="block h-auto w-full" />
          ) : (
            <div className="flex aspect-[297/210] items-center justify-center p-6 text-center text-sm text-stone-500">
              {renderError ? <RenderError message={renderError} retrying={retrying} onRetry={onRetry} /> : loading ? 'Loading fonts…' : ''}
            </div>
          )}
        </div>
      </div>

      {renderError && layout && <RenderError message={renderError} retrying={retrying} onRetry={onRetry} />}
      {layout && layout.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-800" aria-live="polite">
          {layout.warnings.map((w) => (
            <li key={w} className="rounded bg-amber-50 px-2.5 py-1.5">
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RenderError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-sm text-red-700">
      <span>{message}</span>
      {retrying ? (
        <span className="text-stone-500">Retrying automatically…</span>
      ) : (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

/** Hidden on screen; the only thing printed. Sized to the physical page. */
export function PrintSheet({ layout, title }: { layout: CertificateLayout | null; title: string }) {
  if (!layout) return null
  const wmm = (layout.page.width / 72) * 25.4
  const hmm = (layout.page.height / 72) * 25.4
  return (
    <div className="print-sheet" aria-hidden="true">
      <CertificateSvg layout={layout} title={title} className="block" />
      <style>{`@media print { @page { size: ${wmm.toFixed(1)}mm ${hmm.toFixed(1)}mm; margin: 0 } .print-sheet svg { width: ${wmm.toFixed(1)}mm; height: ${hmm.toFixed(1)}mm } }`}</style>
    </div>
  )
}
