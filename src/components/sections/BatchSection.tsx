import { zipSync } from 'fflate'
import { useMemo, useRef, useState } from 'react'
import { certificateBaseName, uniqueFileNames } from '../../lib/api/batch.js'
import { CSV_TEMPLATE, csvToRecords, type CsvRecord } from '../../lib/api/csv.js'
import { exportPdf } from '../../lib/exporter.js'
import { exportErrors } from '../../lib/validation.js'
import type { CertificateConfig } from '../../types/certificate.js'
import { downloadBlob } from '../../utils/download.js'
import { Button } from '../ui/primitives.js'

/** Upper bound for one browser batch (keeps memory and time reasonable). */
const MAX_ROWS = 200

interface Prepared {
  fileName: string
  label: string
  config: CertificateConfig
  problems: string[]
}

/**
 * Apply one CSV row to the current form. CSV records only ever carry text
 * fields of participant/event plus the issue date, so a typed merge is
 * enough — images and design are shared as-is (no re-validation per row).
 */
function applyRow(base: CertificateConfig, row: CsvRecord): CertificateConfig {
  return {
    ...base,
    participant: { ...base.participant, ...row.participant },
    event: { ...base.event, ...row.event },
    issueDate: row.issueDate ?? base.issueDate,
  }
}

interface Props {
  config: CertificateConfig
  notify: (msg: string, tone?: 'info' | 'error') => void
}

/**
 * Generate one certificate per CSV row, entirely in the browser, using the
 * current form as the shared base (template, wording, institution, logos,
 * signatories, event). Downloads a ZIP of PDFs.
 */
export function BatchSection({ config, notify }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [csvText, setCsvText] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Recomputed from the latest form state, so editing the design after
  // loading the CSV is reflected in the batch.
  const parsed = useMemo(() => (csvText === null ? null : csvToRecords(csvText, MAX_ROWS)), [csvText])
  const prepared: Prepared[] = useMemo(() => {
    if (!parsed) return []
    const configs = parsed.records.map((r) => applyRow(config, r))
    const names = uniqueFileNames(
      configs.map((c, i) => certificateBaseName(c.participant.name, `certificate-${i + 1}`)),
      'pdf',
    )
    return configs.map((c, i) => ({
      config: c,
      fileName: names[i],
      label: c.participant.name || `Row ${i + 2}`,
      problems: exportErrors(c).map((e) => e.message),
    }))
  }, [parsed, config])
  const invalid = prepared.filter((p) => p.problems.length)
  const blocking = (parsed?.issues.length ?? 0) > 0 || invalid.length > 0

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return notify('That CSV is larger than 2 MB.', 'error')
    setFileName(file.name)
    setCsvText(await file.text())
    if (fileRef.current) fileRef.current.value = ''
  }

  async function generate() {
    if (!prepared.length || blocking) return
    setProgress({ done: 0, total: prepared.length })
    try {
      const files: Record<string, Uint8Array> = {}
      for (const [i, p] of prepared.entries()) {
        files[p.fileName] = new Uint8Array(await (await exportPdf(p.config)).arrayBuffer())
        setProgress({ done: i + 1, total: prepared.length })
      }
      // PDFs are already compressed; store them without re-compressing.
      const zip = zipSync(files, { level: 0 })
      downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), 'certificates.zip')
      notify(`${prepared.length} certificates downloaded as certificates.zip.`)
    } catch (e) {
      console.error(e)
      notify('Batch generation failed. Please try again.', 'error')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-stone-600">
        Upload a CSV with one row per participant. Each row becomes a certificate that uses everything set above (template, wording,
        institution, logos, signatories). Columns in the CSV override the form, so a column like <code>event_name</code> can vary per row.
      </p>
      <p className="text-xs text-stone-500">
        Recognised columns: <code>name</code> (required), <code>salutation</code>, <code>designation</code>, <code>department</code>,{' '}
        <code>institution</code>, <code>event_name</code>, <code>event_type</code>, <code>organizer</code>, <code>venue</code>,{' '}
        <code>start_date</code>, <code>end_date</code>, <code>description</code>, <code>date</code>. Dates as YYYY-MM-DD (or DD/MM/YYYY). Up
        to {MAX_ROWS} rows.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileRef.current?.click()} disabled={progress !== null}>
          {fileName ? 'Choose another CSV' : 'Upload CSV'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => downloadBlob(new Blob([CSV_TEMPLATE], { type: 'text/csv' }), 'certificate-batch-template.csv')}
        >
          Download CSV template
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload participants CSV"
          onChange={(e) => void loadFile(e.target.files?.[0])}
        />
      </div>

      {parsed && (
        <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3" aria-live="polite">
          <p className="font-medium text-stone-800">
            {fileName}: {prepared.length} certificate{prepared.length === 1 ? '' : 's'}
            {invalid.length > 0 && <span className="text-red-700"> · {invalid.length} with problems</span>}
          </p>
          {parsed.ignoredColumns.length > 0 && (
            <p className="text-xs text-amber-800">Ignored columns: {parsed.ignoredColumns.join(', ')}</p>
          )}
          {(parsed.issues.length > 0 || invalid.length > 0) && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-700" role="alert">
              {parsed.issues.map((i) => (
                <li key={i.message}>{i.message}</li>
              ))}
              {invalid.slice(0, 8).map((p) => (
                <li key={p.fileName}>
                  {p.label}: {p.problems[0]}
                </li>
              ))}
              {invalid.length > 8 && <li>…and {invalid.length - 8} more</li>}
            </ul>
          )}
          {!blocking && prepared.length > 0 && (
            <p className="text-xs text-stone-600">
              Files: {prepared.slice(0, 4).map((p) => p.fileName).join(', ')}
              {prepared.length > 4 && ', …'}
            </p>
          )}
          <Button variant="primary" onClick={() => void generate()} disabled={blocking || !prepared.length || progress !== null}>
            {progress ? `Generating ${progress.done} / ${progress.total}…` : `Generate ${prepared.length} PDFs (ZIP)`}
          </Button>
        </div>
      )}
    </div>
  )
}
