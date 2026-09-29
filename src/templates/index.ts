import { classicTemplate } from './classic'
import { modernTemplate } from './modern'
import { referenceTemplate } from './reference'
import type { TemplateDefinition } from './types'

/**
 * Template registry. To add a template, create a TemplateDefinition in this
 * folder and append it here — nothing else needs to change.
 */
export const TEMPLATES: TemplateDefinition[] = [referenceTemplate, classicTemplate, modernTemplate]

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export type { TemplateDefinition } from './types'
