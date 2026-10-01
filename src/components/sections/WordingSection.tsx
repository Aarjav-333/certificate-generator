import { useMemo, useRef, useState } from 'react'
import type { CertificateActions } from '../../hooks/useCertificate.js'
import { checkTemplate, VARIABLES } from '../../lib/text/placeholders.js'
import { errorFor, type FieldError } from '../../lib/validation.js'
import { getTemplate } from '../../templates/index.js'
import type { CertificateConfig } from '../../types/certificate.js'
import { Button, Field, Grid, TextArea, TextInput } from '../ui/primitives.js'

interface Props {
  config: CertificateConfig
  actions: CertificateActions
  errors: FieldError[]
}

export function WordingSection({ config, actions, errors }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [showHelp, setShowHelp] = useState(false)
  const issues = useMemo(() => checkTemplate(config.body), [config.body])
  const tplDefault = getTemplate(config.templateId).defaults.body

  /** Replace the current selection (or insert at the caret) and keep focus. */
  function edit(transform: (selected: string) => { text: string; caretOffset?: number }) {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const { text, caretOffset } = transform(value.slice(s, e))
    const next = value.slice(0, s) + text + value.slice(e)
    actions.set({ body: next })
    requestAnimationFrame(() => {
      ta.focus()
      const pos = s + (caretOffset ?? text.length)
      ta.setSelectionRange(pos, pos)
    })
  }

  const wrap = (marker: string) =>
    edit((sel) => (sel ? { text: `${marker}${sel}${marker}` } : { text: marker + marker, caretOffset: marker.length }))

  function displayLine() {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: s, value } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const has = value.startsWith('# ', lineStart)
    const next = has ? value.slice(0, lineStart) + value.slice(lineStart + 2) : value.slice(0, lineStart) + '# ' + value.slice(lineStart)
    actions.set({ body: next })
    requestAnimationFrame(() => ta.focus())
  }

  const bodyError = errorFor(errors, 'body-text')

  return (
    <>
      <Grid>
        <Field id="cert-title" label="Certificate title" hint='e.g. "Certificate", "Certificate of Merit"'>
          <TextInput id="cert-title" value={config.title} onChange={(e) => actions.set({ title: e.target.value })} />
        </Field>
        <Field id="cert-tagline" label="Title tagline" hint='Optional, e.g. "of Participation"'>
          <TextInput id="cert-tagline" value={config.titleTagline} onChange={(e) => actions.set({ titleTagline: e.target.value })} />
        </Field>
      </Grid>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="body-text" className="text-[13px] font-medium text-stone-800">
            Certificate text<span className="ml-0.5 text-red-700" aria-hidden="true">*</span>
          </label>
          <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
            <Button size="sm" variant="ghost" onClick={() => wrap('**')} aria-label="Bold" title="Bold (**text**)">
              <b>B</b>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => wrap('*')} aria-label="Italic" title="Italic (*text*)">
              <i className="font-serif">I</i>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => wrap('***')} aria-label="Bold italic" title="Bold italic (***text***)">
              <b>
                <i className="font-serif">BI</i>
              </b>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => edit((sel) => (sel ? { text: `^{${sel}}` } : { text: '^{}', caretOffset: 2 }))}
              aria-label="Superscript"
              title="Superscript (^{th})"
            >
              x<sup>2</sup>
            </Button>
            <Button size="sm" variant="ghost" onClick={displayLine} aria-label="Toggle display line" title="Display line (# at line start)">
              #&nbsp;Line
            </Button>
          </div>
        </div>
        <TextArea
          ref={ref}
          id="body-text"
          rows={7}
          value={config.body}
          invalid={Boolean(bodyError)}
          onChange={(e) => actions.set({ body: e.target.value })}
          spellCheck
          className="font-mono text-[13px]"
        />
        {bodyError && (
          <p id="body-text-error" className="text-xs text-red-700" role="alert">
            {bodyError}
          </p>
        )}
        {issues.length > 0 && !bodyError && (
          <ul className="list-disc pl-5 text-xs text-amber-800" aria-live="polite">
            {issues.map((i) => (
              <li key={i.message}>{i.message}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-medium text-stone-800" id="var-label">
          Insert a variable at the cursor
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="var-label">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.help}
              onClick={() => edit(() => ({ text: `{{${v.key}}}` }))}
              className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[11.5px] text-stone-700 hover:border-indigo-400 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-700"
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setShowHelp((s) => !s)} aria-expanded={showHelp}>
          {showHelp ? 'Hide' : 'Show'} formatting help
        </Button>
        {config.body.trim() !== tplDefault.trim() && (
          <Button size="sm" variant="ghost" onClick={() => actions.set({ body: tplDefault })}>
            Restore template wording
          </Button>
        )}
      </div>

      {showHelp && (
        <div className="space-y-2 rounded-md bg-stone-100 p-3 text-xs leading-relaxed text-stone-700">
          <p>
            <code>{'{{name}}'}</code> inserts a value. Add <code>|upper</code>, <code>|lower</code> or <code>|title</code> to change case,
            e.g. <code>{'{{name|upper}}'}</code>.
          </p>
          <p>
            <code>{'{{#organizer}}, organized by {{organizer}}{{/organizer}}'}</code> only appears when the organizer is filled in;{' '}
            <code>{'{{^venue}}…{{/venue}}'}</code> only when it is empty.
          </p>
          <p>
            <code>*italic*</code>, <code>**bold**</code> (bold text uses the accent colour), <code>***bold italic***</code>,{' '}
            <code>^{'{th}'}</code> for superscript.
          </p>
          <p>
            Start a line with <code>#&nbsp;</code> for a large centred display line (e.g. the name). A new line starts a new paragraph; a
            blank line adds space. Use <code>\*</code> for a literal asterisk.
          </p>
          <p>Extra spaces and stray commas left by empty fields are tidied automatically.</p>
        </div>
      )}
    </>
  )
}
