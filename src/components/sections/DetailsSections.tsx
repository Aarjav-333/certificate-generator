import type { CertificateActions } from '../../hooks/useCertificate.js'
import { errorFor, type FieldError } from '../../lib/validation.js'
import { TEMPLATES } from '../../templates/index.js'
import type { CertificateConfig } from '../../types/certificate.js'
import { ImageUpload } from '../ui/ImageUpload.js'
import { cx } from '../ui/cx.js'
import { Field, Grid, Range, TextArea, TextInput } from '../ui/primitives.js'

interface Props {
  config: CertificateConfig
  actions: CertificateActions
  errors: FieldError[]
}

export function TemplateSection({ config, onSelect }: { config: CertificateConfig; onSelect: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Certificate template</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEMPLATES.map((t) => {
          const active = t.id === config.templateId
          return (
            <label
              key={t.id}
              className={cx(
                'flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-left transition-colors focus-within:outline-2 focus-within:outline-indigo-700',
                active ? 'border-[#262A6B] bg-indigo-50/60 ring-1 ring-[#262A6B]' : 'border-stone-300 bg-white hover:bg-stone-50',
              )}
            >
              <input type="radio" name="template" value={t.id} checked={active} onChange={() => onSelect(t.id)} className="sr-only" />
              <span className="text-sm font-semibold text-stone-900">{t.name}</span>
              <span className="text-xs leading-snug text-stone-600">{t.description}</span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Switching template applies its design. Your details are kept, and so is your wording if you have edited it.
      </p>
    </fieldset>
  )
}

export function InstitutionSection({ config, actions, errors }: Props) {
  const inst = config.institution
  return (
    <>
      <Field id="inst-name" label="Institution name" required error={errorFor(errors, 'inst-name')}>
        <TextInput
          id="inst-name"
          value={inst.name}
          invalid={Boolean(errorFor(errors, 'inst-name'))}
          placeholder="College of Engineering Trivandrum"
          onChange={(e) => actions.institution({ name: e.target.value })}
        />
      </Field>
      <Grid>
        <Field id="inst-subtitle" label="Subtitle" hint="Address, city or affiliation line">
          <TextInput id="inst-subtitle" value={inst.subtitle} onChange={(e) => actions.institution({ subtitle: e.target.value })} />
        </Field>
        <Field id="inst-dept" label="Department / organization" hint="Optional line below the subtitle">
          <TextInput id="inst-dept" value={inst.department} onChange={(e) => actions.institution({ department: e.target.value })} />
        </Field>
      </Grid>
      <ImageUpload
        label="Institution logo"
        kind="logo"
        value={inst.logo}
        onChange={(logo) => actions.institution({ logo })}
        hint="Transparent PNG or SVG works best. The logo is never stretched."
      />
      {inst.logo && (
        <Range
          id="logo-size"
          label="Logo height"
          value={inst.logoSize}
          min={30}
          max={130}
          step={1}
          unit=" pt"
          onChange={(logoSize) => actions.institution({ logoSize })}
        />
      )}
    </>
  )
}

export function ParticipantSection({ config, actions, errors }: Props) {
  const p = config.participant
  return (
    <>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Field id="participant-salutation" label="Title" hint="Optional">
          <TextInput
            id="participant-salutation"
            value={p.salutation}
            placeholder="Dr."
            onChange={(e) => actions.participant({ salutation: e.target.value })}
          />
        </Field>
        <Field id="participant-name" label="Full name" required error={errorFor(errors, 'participant-name')}>
          <TextInput
            id="participant-name"
            value={p.name}
            invalid={Boolean(errorFor(errors, 'participant-name'))}
            autoComplete="off"
            onChange={(e) => actions.participant({ name: e.target.value })}
          />
        </Field>
      </div>
      <Grid>
        <Field id="participant-designation" label="Designation">
          <TextInput
            id="participant-designation"
            value={p.designation}
            onChange={(e) => actions.participant({ designation: e.target.value })}
          />
        </Field>
        <Field id="participant-department" label="Department">
          <TextInput
            id="participant-department"
            value={p.department}
            onChange={(e) => actions.participant({ department: e.target.value })}
          />
        </Field>
      </Grid>
      <Field id="participant-institution" label="Institution / organization">
        <TextInput
          id="participant-institution"
          value={p.institution}
          onChange={(e) => actions.participant({ institution: e.target.value })}
        />
      </Field>
    </>
  )
}

export function EventSection({ config, actions, errors }: Props) {
  const e = config.event
  return (
    <>
      <Field id="event-name" label="Event name" required error={errorFor(errors, 'event-name')}>
        <TextInput
          id="event-name"
          value={e.name}
          invalid={Boolean(errorFor(errors, 'event-name'))}
          onChange={(ev) => actions.event({ name: ev.target.value })}
        />
      </Field>
      <Grid>
        <Field id="event-type" label="Event type" hint="e.g. workshop, FDP, seminar">
          <TextInput id="event-type" value={e.type} onChange={(ev) => actions.event({ type: ev.target.value })} />
        </Field>
        <Field id="event-organizer" label="Organizer">
          <TextInput id="event-organizer" value={e.organizer} onChange={(ev) => actions.event({ organizer: ev.target.value })} />
        </Field>
      </Grid>
      <Field id="event-venue" label="Venue">
        <TextInput id="event-venue" value={e.venue} onChange={(ev) => actions.event({ venue: ev.target.value })} />
      </Field>
      <Grid cols={3}>
        <Field id="event-start" label="Start date">
          <TextInput id="event-start" type="date" value={e.startDate} onChange={(ev) => actions.event({ startDate: ev.target.value })} />
        </Field>
        <Field id="event-end" label="End date" error={errorFor(errors, 'event-end')}>
          <TextInput
            id="event-end"
            type="date"
            value={e.endDate}
            min={e.startDate || undefined}
            invalid={Boolean(errorFor(errors, 'event-end'))}
            onChange={(ev) => actions.event({ endDate: ev.target.value })}
          />
        </Field>
        <Field id="issue-date" label="Issue date" hint="For {{date}}">
          <TextInput id="issue-date" type="date" value={config.issueDate} onChange={(ev) => actions.set({ issueDate: ev.target.value })} />
        </Field>
      </Grid>
      <Field id="event-description" label="Additional description" hint="Available as {{description}}, e.g. “sponsored by …”">
        <TextArea
          id="event-description"
          rows={2}
          value={e.description}
          onChange={(ev) => actions.event({ description: ev.target.value })}
        />
      </Field>
    </>
  )
}
