import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { PreviewPanel, PrintSheet, type ExportKind } from './components/PreviewPanel'
import { DesignSection } from './components/sections/DesignSection'
import { EventSection, InstitutionSection, ParticipantSection, TemplateSection } from './components/sections/DetailsSections'
import { GraphicsSection } from './components/sections/GraphicsSection'
import { SignatoriesSection } from './components/sections/SignatoriesSection'
import { WordingSection } from './components/sections/WordingSection'
import { Section } from './components/ui/primitives'
import { Toasts, type Toast } from './components/ui/Toasts'
import { sampleConfig } from './data/sample'
import { useAutosave } from './hooks/useAutosave'
import { useCertificate } from './hooks/useCertificate'
import { useCertificateLayout } from './hooks/useCertificateLayout'
import { applyTemplate, blankConfig } from './lib/config'
import { downloadImage, downloadPdf } from './lib/exporter'
import { loadFonts } from './lib/fonts/loader'
import { clearAllSaved, clearDraft, loadDraft } from './lib/storage'
import { exportErrors, liveErrors } from './lib/validation'
import { getTemplate } from './templates'
import { requiredFonts } from './templates/engine'
import type { CertificateConfig } from './types/certificate'

type SectionId = 'template' | 'institution' | 'participant' | 'event' | 'wording' | 'graphics' | 'signatories' | 'design'

const SECTIONS: Array<{ id: SectionId; title: string; description: string }> = [
  { id: 'template', title: 'Template', description: 'Choose the certificate design' },
  { id: 'institution', title: 'Institution', description: 'Heading, subtitle and logo' },
  { id: 'participant', title: 'Participant', description: 'Who receives the certificate' },
  { id: 'event', title: 'Event', description: 'Name, organizer, venue and dates' },
  { id: 'wording', title: 'Certificate text', description: 'Wording with {{variables}}' },
  { id: 'graphics', title: 'Event graphic & background', description: 'Optional emblem and backdrop' },
  { id: 'signatories', title: 'Signatories', description: 'Names, designations and signatures' },
  { id: 'design', title: 'Design', description: 'Fonts, colours, border, layout' },
]

/** Which form section owns a validation field id. */
function sectionForField(field: string): SectionId {
  if (field.startsWith('inst-')) return 'institution'
  if (field.startsWith('participant-')) return 'participant'
  if (field.startsWith('event-') || field === 'issue-date') return 'event'
  if (field.startsWith('sig-')) return 'signatories'
  return 'wording'
}

export default function App() {
  const [initial, setInitial] = useState<CertificateConfig | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const draft = await loadDraft().catch(() => null)
      // Start downloading the certificate's fonts now, in parallel with building
      // the sample assets, instead of waiting for the first preview render.
      void loadFonts(requiredFonts(draft ?? blankConfig('reference'))).catch(() => {})
      const cfg = draft ?? (await sampleConfig('reference'))
      if (alive) setInitial(cfg)
    })()
    return () => {
      alive = false
    }
  }, [])
  if (!initial) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">Loading certificate generator…</div>
  }
  return <Generator initial={initial} />
}

function Generator({ initial }: { initial: CertificateConfig }) {
  const { config, actions } = useCertificate(initial)
  const { layout, loading, error: renderError } = useCertificateLayout(config)
  const autosave = useAutosave(config, true)
  const [open, setOpen] = useState<Set<SectionId>>(() => new Set(['template', 'institution', 'participant', 'event']))
  const [showExportErrors, setShowExportErrors] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  // After a failed export attempt, show every blocking error until it is fixed; before that only live ones.
  const errors = useMemo(() => (showExportErrors ? exportErrors(config) : liveErrors(config)), [config, showExportErrors])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'info', action?: Toast['action']) => {
      const id = ++toastId.current
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }])
      setTimeout(() => dismiss(id), action ? 8000 : 4000)
    },
    [dismiss],
  )

  const toggle = (id: SectionId) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const focusField = useCallback((field: string) => {
    setOpen((s) => new Set(s).add(sectionForField(field)))
    // Wait a tick for the section to open before focusing its field.
    setTimeout(() => {
      const el = document.getElementById(field)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
    }, 50)
  }, [])

  async function handleExport(kind: ExportKind) {
    const errs = exportErrors(config)
    if (errs.length) {
      setShowExportErrors(true)
      focusField(errs[0].field)
      notify(`Cannot generate yet — ${errs.length} issue${errs.length > 1 ? 's' : ''} to fix.`, 'error')
      return
    }
    try {
      if (kind === 'pdf') await downloadPdf(config)
      else if (kind === 'png') await downloadImage(config, 'image/png')
      else if (kind === 'jpg') await downloadImage(config, 'image/jpeg')
      else {
        await document.fonts.ready
        window.print()
        return
      }
      notify(`${kind.toUpperCase()} downloaded.`)
    } catch (e) {
      console.error(e)
      notify(`Export failed: ${e instanceof Error ? e.message : 'unknown error'}`, 'error')
    }
  }

  function handleLoad(cfg: CertificateConfig, message: string) {
    actions.replace(cfg)
    setShowExportErrors(false)
    notify(message)
  }

  async function handleReset() {
    const before = config
    actions.replace(await sampleConfig(config.templateId))
    setShowExportErrors(false)
    notify('Form reset to the template’s sample values.', 'info', { label: 'Undo', run: () => actions.replace(before) })
  }

  async function handleClear(alsoSaved: boolean) {
    const blank = { ...blankConfig(config.templateId), signatories: [] }
    actions.replace(blank)
    setShowExportErrors(false)
    await clearDraft()
    if (alsoSaved) await clearAllSaved()
    notify(alsoSaved ? 'Everything cleared, including saved certificates.' : 'Everything cleared.')
  }

  const title = `Certificate preview${config.participant.name ? ` for ${config.participant.name}` : ''}`

  const sectionBody = (id: SectionId) => {
    const props = { config, actions, errors }
    switch (id) {
      case 'template':
        return <TemplateSection config={config} onSelect={(tid) => actions.replace(applyTemplate(config, getTemplate(tid)))} />
      case 'institution':
        return <InstitutionSection {...props} />
      case 'participant':
        return <ParticipantSection {...props} />
      case 'event':
        return <EventSection {...props} />
      case 'wording':
        return <WordingSection {...props} />
      case 'graphics':
        return <GraphicsSection config={config} actions={actions} />
      case 'signatories':
        return <SignatoriesSection {...props} />
      case 'design':
        return <DesignSection config={config} actions={actions} />
    }
  }

  return (
    <>
      <a href="#config" className="no-print sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2">
        Skip to form
      </a>
      <AppHeader
        config={config}
        autosave={autosave}
        onLoad={handleLoad}
        onReset={() => void handleReset()}
        onClear={handleClear}
        notify={notify}
      />
      <main className="no-print mx-auto grid max-w-[1600px] gap-5 px-4 py-5 lg:grid-cols-[minmax(380px,520px)_1fr] lg:items-start">
        <div className="order-2 lg:order-1">
          <form
            id="config"
            aria-label="Certificate configuration"
            onSubmit={(e) => e.preventDefault()}
            className="overflow-hidden rounded-lg border border-stone-200 bg-white"
          >
            {SECTIONS.map((s, i) => (
              <Section key={s.id} step={i + 1} title={s.title} description={s.description} open={open.has(s.id)} onToggle={() => toggle(s.id)}>
                {sectionBody(s.id)}
              </Section>
            ))}
          </form>
          <p className="mt-3 px-1 text-xs text-stone-500">
            Everything stays in your browser — nothing is uploaded to a server.
          </p>
        </div>
        <div className="order-1 lg:sticky lg:top-[72px] lg:order-2">
          <PreviewPanel
            layout={layout}
            loading={loading}
            renderError={renderError}
            title={title}
            errors={showExportErrors ? errors : []}
            onExport={handleExport}
            onFocusField={focusField}
          />
        </div>
      </main>
      <PrintSheet layout={layout} title={title} />
      <Toasts toasts={toasts} dismiss={dismiss} />
    </>
  )
}
