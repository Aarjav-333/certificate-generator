import { useId, useRef, useState, type DragEvent } from 'react'
import { ACCEPT_ATTR, ImageUploadError, processImageFile, type ImageKind, type ProcessOptions } from '../../lib/images'
import type { ImageAsset } from '../../types/certificate'
import { cx } from './cx'
import { Button, TextInput } from './primitives'

interface Props {
  label: string
  kind: ImageKind
  value: ImageAsset | null
  onChange: (asset: ImageAsset | null) => void
  hint?: string
  options?: ProcessOptions
  /** Show an input for alternative text. */
  withAlt?: boolean
  compact?: boolean
}

/** Drag-and-drop / click-to-browse image upload with validation and preview. */
export function ImageUpload({ label, kind, value, onChange, hint, options, withAlt = true, compact }: Props) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const asset = await processImageFile(file, kind, options)
      onChange(asset)
    } catch (e) {
      setError(e instanceof ImageUploadError ? e.message : 'The image could not be processed.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-medium text-stone-800">
        {label}
      </span>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'flex items-center gap-3 rounded-md border border-dashed p-2.5 transition-colors',
          dragging ? 'border-indigo-600 bg-indigo-50' : 'border-stone-300 bg-stone-50',
        )}
      >
        <div
          className={cx(
            'flex shrink-0 items-center justify-center overflow-hidden rounded border border-stone-200',
            compact ? 'size-12' : 'size-16',
          )}
          style={{
            backgroundImage:
              'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0,0 5px,5px -5px,-5px 0',
            backgroundColor: '#fff',
          }}
        >
          {value ? (
            <img src={value.dataUrl} alt={value.alt || `${label} preview`} className="max-h-full max-w-full object-contain" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 text-stone-400">
              <path
                d="M4 16l4-4 3 3 5-5 4 4M4 5h16v14H4z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {value ? (
            <p className="truncate text-xs text-stone-600" title={value.name}>
              {value.name} · {value.width}×{value.height}px
            </p>
          ) : (
            <p className="text-xs text-stone-500">Drop an image here or browse. PNG, JPG, WebP or SVG, up to 15 MB.</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy} aria-describedby={`${id}-label`}>
              {busy ? 'Processing…' : value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label={`Remove ${label.toLowerCase()}`}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-stone-500">{hint}</p>}
      {withAlt && value && (
        <TextInput
          id={`${id}-alt`}
          aria-label={`${label} alternative text`}
          placeholder="Alternative text (describes the image for screen readers)"
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}
