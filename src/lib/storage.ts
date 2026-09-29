import { createStore, del, get, set } from 'idb-keyval'
import type { CertificateConfig } from '../types/certificate'
import { newId } from '../utils/dataUrl'
import { normalizeConfig } from './config'

/**
 * Client-side persistence. IndexedDB is used instead of localStorage because
 * configurations embed images, which quickly exceed localStorage's ~5 MB quota.
 */
const store = createStore('certificate-generator', 'kv')
const DRAFT = 'draft'
const SAVED = 'saved'

export interface SavedEntry {
  id: string
  name: string
  savedAt: string
  config: CertificateConfig
}

export async function loadDraft(): Promise<CertificateConfig | null> {
  const raw = await get(DRAFT, store)
  if (!raw) return null
  try {
    return normalizeConfig(raw)
  } catch {
    return null
  }
}

export const saveDraft = (cfg: CertificateConfig) => set(DRAFT, cfg, store)
export const clearDraft = () => del(DRAFT, store)

export async function listSaved(): Promise<SavedEntry[]> {
  const list = ((await get(SAVED, store)) as SavedEntry[] | undefined) ?? []
  return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Save under a name; saving again with the same name overwrites it. */
export async function saveNamed(name: string, config: CertificateConfig): Promise<SavedEntry> {
  const list = ((await get(SAVED, store)) as SavedEntry[] | undefined) ?? []
  const existing = list.find((e) => e.name.toLowerCase() === name.toLowerCase())
  const entry: SavedEntry = { id: existing?.id ?? newId(), name, savedAt: new Date().toISOString(), config }
  await set(SAVED, [...list.filter((e) => e.id !== entry.id), entry], store)
  return entry
}

export async function loadSaved(id: string): Promise<CertificateConfig | null> {
  const list = ((await get(SAVED, store)) as SavedEntry[] | undefined) ?? []
  const e = list.find((x) => x.id === id)
  return e ? normalizeConfig(e.config) : null
}

export async function deleteSaved(id: string): Promise<void> {
  const list = ((await get(SAVED, store)) as SavedEntry[] | undefined) ?? []
  await set(SAVED, list.filter((e) => e.id !== id), store)
}

export const clearAllSaved = () => del(SAVED, store)
