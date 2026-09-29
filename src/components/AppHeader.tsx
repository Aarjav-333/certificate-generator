import { useEffect, useRef, useState } from 'react'
import type { AutosaveStatus } from '../hooks/useAutosave'
import { ConfigImportError, parseConfigJson, serializeConfig } from '../lib/config'
import { deleteSaved, listSaved, loadSaved, saveNamed, type SavedEntry } from '../lib/storage'
import type { CertificateConfig } from '../types/certificate'
import { downloadBlob, safeFileName } from '../utils/download'
import { Dialog } from './ui/Dialog'
import { Button, Field, TextInput, Toggle } from './ui/primitives'

interface Props {
  config: CertificateConfig
  autosave: AutosaveStatus
  onLoad: (cfg: CertificateConfig, source: string) => void
  onReset: () => void
  onClear: (alsoSaved: boolean) => Promise<void>
  notify: (msg: string, tone?: 'info' | 'error') => void
}

export function AppHeader({ config, autosave, onLoad, onReset, onClear, notify }: Props) {
  const [dialog, setDialog] = useState<'save' | 'load' | 'clear' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function exportJson() {
    const name = safeFileName('certificate-config', config.event.name || config.participant.name)
    downloadBlob(new Blob([serializeConfig(config)], { type: 'application/json' }), `${name}.json`)
    notify('Configuration exported as JSON.')
  }

  async function importJson(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 60 * 1024 * 1024) throw new ConfigImportError('That file is too large to be a configuration.')
      onLoad(parseConfigJson(await file.text()), `Imported “${file.name}”.`)
    } catch (e) {
      notify(e instanceof ConfigImportError ? e.message : 'Could not import that file.', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <header className="no-print sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
            <rect x="3" y="6" width="26" height="20" rx="1.5" fill="#fff" stroke="#262A6B" strokeWidth="1.6" />
            <path d="M8 12h16M10 16h12M12 20h8" stroke="#8E1F57" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <div>
            <h1 className="text-[15px] leading-tight font-semibold text-stone-900">Certificate Generator</h1>
            <p className="text-[11px] leading-tight text-stone-500" aria-live="polite">
              {autosave === 'saving' ? 'Saving draft…' : autosave === 'error' ? 'Draft could not be saved' : 'Draft saved in this browser'}
            </p>
          </div>
        </div>
        <nav aria-label="Configuration" className="ml-auto flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => setDialog('save')}>
            Save
          </Button>
          <Button size="sm" onClick={() => setDialog('load')}>
            Load
          </Button>
          <Button size="sm" onClick={exportJson}>
            Export JSON
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import configuration JSON file"
            onChange={(e) => void importJson(e.target.files?.[0])}
          />
          <span className="mx-1 hidden w-px self-stretch bg-stone-200 sm:block" />
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset form
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDialog('clear')}>
            Clear everything
          </Button>
        </nav>
      </div>

      {dialog === 'save' && <SaveDialog onClose={() => setDialog(null)} config={config} notify={notify} />}
      <LoadDialog
        open={dialog === 'load'}
        onClose={() => setDialog(null)}
        onLoad={(cfg, name) => {
          onLoad(cfg, `Loaded “${name}”.`)
          setDialog(null)
        }}
        notify={notify}
      />
      {dialog === 'clear' && (
        <ClearDialog
          onClose={() => setDialog(null)}
          onConfirm={async (alsoSaved) => {
            await onClear(alsoSaved)
            setDialog(null)
          }}
        />
      )}
    </header>
  )
}

function defaultSaveName(cfg: CertificateConfig) {
  return [cfg.event.name, cfg.participant.name].filter(Boolean).join(' – ') || 'Untitled certificate'
}

function SaveDialog({ onClose, config, notify }: { onClose: () => void; config: CertificateConfig; notify: Props['notify'] }) {
  const [name, setName] = useState(() => defaultSaveName(config))
  const [existing, setExisting] = useState<SavedEntry[]>([])
  useEffect(() => {
    void listSaved().then(setExisting)
  }, [])
  const overwrites = existing.some((e) => e.name.toLowerCase() === name.trim().toLowerCase())
  async function save() {
    const n = name.trim()
    if (!n) return
    try {
      await saveNamed(n, config)
      notify(`Saved “${n}”.`)
      onClose()
    } catch {
      notify('Saving failed — the browser storage may be full.', 'error')
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Save certificate"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim()}>
            {overwrites ? 'Overwrite' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field id="save-name" label="Name" hint={overwrites ? 'A saved configuration with this name will be replaced.' : 'Stored in this browser, including images.'}>
          <TextInput id="save-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </form>
    </Dialog>
  )
}

function LoadDialog({
  open,
  onClose,
  onLoad,
  notify,
}: {
  open: boolean
  onClose: () => void
  onLoad: (cfg: CertificateConfig, name: string) => void
  notify: Props['notify']
}) {
  const [items, setItems] = useState<SavedEntry[] | null>(null)
  useEffect(() => {
    if (open) void listSaved().then(setItems)
  }, [open])
  async function load(e: SavedEntry) {
    const cfg = await loadSaved(e.id)
    if (cfg) onLoad(cfg, e.name)
    else notify('That configuration could not be loaded.', 'error')
  }
  async function remove(e: SavedEntry) {
    await deleteSaved(e.id)
    setItems(await listSaved())
    notify(`Deleted “${e.name}”.`)
  }
  return (
    <Dialog open={open} onClose={onClose} title="Load certificate" footer={<Button onClick={onClose}>Close</Button>}>
      {!items ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-stone-600">No saved certificates yet. Use “Save” to store the current configuration in this browser.</p>
      ) : (
        <ul className="divide-y divide-stone-200">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900">{e.name}</p>
                <p className="text-xs text-stone-500">{new Date(e.savedAt).toLocaleString()}</p>
              </div>
              <Button size="sm" variant="primary" onClick={() => void load(e)}>
                Load
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void remove(e)} aria-label={`Delete ${e.name}`}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}

function ClearDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (alsoSaved: boolean) => Promise<void> }) {
  const [alsoSaved, setAlsoSaved] = useState(false)
  return (
    <Dialog
      open
      onClose={onClose}
      title="Clear everything?"
      footer={
        <>
          <Button onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" className="!bg-red-700 !text-white hover:!bg-red-800" onClick={() => void onConfirm(alsoSaved)}>
            Clear everything
          </Button>
        </>
      }
    >
      <p className="text-stone-700">
        This removes all entered information, the logo, event graphic, background, signatories and signatures from the current
        certificate. This cannot be undone.
      </p>
      <div className="mt-3">
        <Toggle label="Also delete all saved certificates in this browser" checked={alsoSaved} onChange={setAlsoSaved} />
      </div>
    </Dialog>
  )
}
