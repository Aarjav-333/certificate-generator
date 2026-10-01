import { classicTemplate } from './classic.js'
import { modernTemplate } from './modern.js'
import { referenceTemplate } from './reference.js'
import type { TemplateDefinition } from './types.js'

/**
 * Template registry. To add a template, create a TemplateDefinition in this
 * folder and append it here — nothing else needs to change.
 */
export const TEMPLATES: TemplateDefinition[] = [referenceTemplate, classicTemplate, modernTemplate]

export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export type { TemplateDefinition } from './types.js'
