import type { CertificateConfig } from '../../types/certificate.js'
import { ApiError, validationError, type FieldIssue } from './errors.js'
import { API_LIMITS } from './limits.js'
import { parseCertificateRequest, unwrapCertificate, type ImageDecoder } from './request.js'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Sections that are merged key by key; everything else (incl. signatories) is replaced. */
const MERGED_SECTIONS = ['institution', 'participant', 'event', 'eventGraphic', 'background', 'design']

/**
 * Overlay one batch record on the shared base: sections such as participant
 * and event are merged field by field, other values are replaced.
 */
export function mergeRecord(base: Obj, record: Obj): Obj {
  const out: Obj = { ...base }
  for (const [k, v] of Object.entries(record)) {
    out[k] = MERGED_SECTIONS.includes(k) && isObj(v) && isObj(base[k]) ? { ...(base[k] as Obj), ...v } : v
  }
  return out
}

/**
 * Filesystem-safe PDF file name from a person's name: letters and digits
 * only (accents stripped), words joined with hyphens — e.g.
 * "Aarjav Oravakandi" → "Aarjav-Oravakandi". It can never contain path
 * separators or dots, so it cannot escape the archive.
 */
export function certificateBaseName(name: string, fallback: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  return s || fallback
}

/** Make names unique within one archive: Name.pdf, Name-2.pdf, … (case-insensitive). */
export function uniqueFileNames(names: string[], extension: string): string[] {
  const used = new Map<string, number>()
  return names.map((n) => {
    const key = n.toLowerCase()
    const count = (used.get(key) ?? 0) + 1
    used.set(key, count)
    return `${count === 1 ? n : `${n}-${count}`}.${extension}`
  })
}

export interface BatchItem {
  config: CertificateConfig
  fileName: string
}

/**
 * Validate a batch request: shared base fields at the top level plus
 * `certificates: [...]`, each overriding the base. Every record is validated
 * before anything is generated, so a bad record fails the whole request
 * with a precise error instead of a truncated archive.
 */
export async function parseBatchRequest(raw: unknown, decodeImage: ImageDecoder): Promise<BatchItem[]> {
  const root = unwrapCertificate(raw)
  const { certificates, ...base } = root
  if (!Array.isArray(certificates) || certificates.length === 0)
    throw validationError([{ field: 'certificates', message: 'certificates must be a non-empty array' }])
  if (certificates.length > API_LIMITS.maxBatchCertificates)
    throw new ApiError(
      413,
      'PayloadTooLarge',
      `A batch can contain at most ${API_LIMITS.maxBatchCertificates} certificates (got ${certificates.length}). Split it into several requests.`,
    )

  // Images in the shared base are identical across records: decode each once.
  const cache = new Map<unknown, ReturnType<ImageDecoder>>()
  const cachedDecode: ImageDecoder = (value, field) => {
    if (typeof value !== 'string' && !isObj(value)) return decodeImage(value, field)
    let p = cache.get(value)
    if (!p) {
      p = decodeImage(value, field)
      cache.set(value, p)
    }
    return p
  }

  const issues: FieldIssue[] = []
  const configs: CertificateConfig[] = []
  for (const [i, record] of certificates.entries()) {
    if (!isObj(record)) {
      issues.push({ field: `certificates[${i}]`, message: `certificates[${i}] must be an object` })
      continue
    }
    try {
      configs.push(await parseCertificateRequest(mergeRecord(base, record), cachedDecode, `certificates[${i}].`))
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.details) issues.push(...e.details)
      else throw e
    }
    if (issues.length >= 50) break
  }
  if (issues.length) throw validationError(issues)

  const names = uniqueFileNames(
    configs.map((c, i) => certificateBaseName(c.participant.name, `certificate-${i + 1}`)),
    'pdf',
  )
  return configs.map((config, i) => ({ config, fileName: names[i] }))
}
