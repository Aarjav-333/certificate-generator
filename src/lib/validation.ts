import type { CertificateConfig } from '../types/certificate'
import { parseIsoDate } from '../utils/date'
import { checkTemplate } from './text/placeholders'

export interface FieldError {
  /** Stable field id — matches the `id` of the form control so we can focus it. */
  field: string
  message: string
}

/** Problems that are visible immediately, while typing. */
export function liveErrors(cfg: CertificateConfig): FieldError[] {
  const errs: FieldError[] = []
  const { startDate, endDate } = cfg.event
  if (startDate && endDate && parseIsoDate(startDate) && parseIsoDate(endDate) && startDate > endDate)
    errs.push({ field: 'event-end', message: 'End date is before the start date.' })
  return errs
}

/** Everything that must be fixed before a certificate can be generated. */
export function exportErrors(cfg: CertificateConfig): FieldError[] {
  const errs: FieldError[] = []
  if (!cfg.institution.name.trim()) errs.push({ field: 'inst-name', message: 'Institution name is required.' })
  if (!cfg.participant.name.trim()) errs.push({ field: 'participant-name', message: 'Participant name is required.' })
  if (!cfg.event.name.trim()) errs.push({ field: 'event-name', message: 'Event name is required.' })
  else if (cfg.event.name.trim().length < 3) errs.push({ field: 'event-name', message: 'Event name looks too short.' })
  errs.push(...liveErrors(cfg))
  if (!cfg.body.trim()) errs.push({ field: 'body-text', message: 'Certificate text is empty.' })
  const tplIssues = checkTemplate(cfg.body)
  if (tplIssues.length) errs.push({ field: 'body-text', message: tplIssues[0].message })
  cfg.signatories.forEach((s, i) => {
    if (!s.name.trim()) errs.push({ field: `sig-${s.id}-name`, message: `Signatory ${i + 1} needs a name (or remove it).` })
  })
  return errs
}

export function errorFor(errors: FieldError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message
}
