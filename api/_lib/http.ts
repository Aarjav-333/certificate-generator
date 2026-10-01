import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { ApiError } from '../../src/lib/api/errors.js'
import { API_LIMITS } from '../../src/lib/api/limits.js'
import { takeTokens } from './ratelimit.js'

export interface HandlerContext {
  request: Request
  requestId: string
  url: URL
  /** Read and parse the JSON body (size-limited). */
  readJson(): Promise<unknown>
  /** Charge additional rate-limit units (e.g. one per certificate in a batch). */
  charge(units: number): void
}

interface HandlerOptions {
  methods: string[]
  /** Require `Authorization: Bearer <CERTIFICATE_API_KEY>`. */
  auth: boolean
}

const sha256 = (s: string) => createHash('sha256').update(s).digest()

function configuredKeys(): string[] {
  // Comma-separated list allows rotating keys without downtime.
  return (process.env.CERTIFICATE_API_KEY ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

/** Constant-time comparison of the presented key against every configured key. */
function matchKey(presented: string, keys: string[]): string | null {
  const p = sha256(presented)
  let match: string | null = null
  for (const k of keys) if (timingSafeEqual(p, sha256(k))) match = k
  return match
}

function clientIp(request: Request): string {
  return request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

const rateLimit = () => Math.max(1, Number(process.env.CERTIFICATE_API_RATE_LIMIT) || 60)
const FAILED_AUTH_LIMIT = 20

/**
 * CORS is off unless CERTIFICATE_API_CORS_ORIGINS lists allowed origins
 * (comma-separated, or "*"). Server-to-server callers never need it.
 */
function corsHeaders(request: Request, methods: string[]): Record<string, string> {
  const origin = request.headers.get('origin')
  const allowed = (process.env.CERTIFICATE_API_CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
  if (!origin || !allowed.length) return {}
  if (!allowed.includes('*') && !allowed.includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': allowed.includes('*') ? '*' : origin,
    'Access-Control-Allow-Methods': [...methods, 'OPTIONS'].join(', '),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Disposition, X-Request-Id, X-Certificate-Warnings, Retry-After',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

/** Header-safe (ASCII) list of layout warnings. */
export function warningsHeader(warnings: string[]): Record<string, string> {
  if (!warnings.length) return {}
  const ascii = warnings
    .map((w) => w.normalize('NFKD').replace(/[“”]/g, '"').replace(/[—–]/g, '-').replace(/[^\x20-\x7E]/g, ''))
    .join(' | ')
  return { 'X-Certificate-Warnings': ascii.slice(0, 2000) }
}

/**
 * Binary response streamed in chunks. Streaming keeps large certificates
 * (e.g. with a full-page background photo) clear of the 4.5 MB limit Vercel
 * applies to buffered function responses.
 */
export function binaryResponse(bytes: Uint8Array, headers: Record<string, string>): Response {
  const CHUNK = 256 * 1024
  let offset = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) return controller.close()
      controller.enqueue(bytes.subarray(offset, offset + CHUNK))
      offset += CHUNK
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Cache-Control': 'no-store', 'Content-Length': String(bytes.length), ...headers },
  })
}

async function readLimitedBody(request: Request, max: number): Promise<string> {
  const declared = Number(request.headers.get('content-length'))
  if (declared > max) throw tooLarge(max)
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      throw tooLarge(max)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const tooLarge = (max: number) =>
  new ApiError(413, 'PayloadTooLarge', `The request body is larger than ${Math.round(max / 1048576)} MB. Reduce or compress the images.`)

/**
 * Wrap an endpoint with the cross-cutting API concerns: CORS, method check,
 * API-key authentication, rate limiting, size-limited JSON parsing and safe
 * error responses. Unexpected errors are logged with a request id and
 * returned as a generic 500 — no stack traces, paths or secrets leak out.
 */
export function apiHandler(options: HandlerOptions, handler: (ctx: HandlerContext) => Promise<Response>) {
  return async function handle(request: Request): Promise<Response> {
    const requestId = randomUUID()
    const cors = corsHeaders(request, options.methods)
    const base = { 'X-Request-Id': requestId, ...cors }
    const withHeaders = (res: Response) => {
      for (const [k, v] of Object.entries(base)) res.headers.set(k, v)
      return res
    }

    try {
      if (request.method === 'OPTIONS') return withHeaders(new Response(null, { status: 204, headers: { Allow: [...options.methods, 'OPTIONS'].join(', ') } }))
      if (!options.methods.includes(request.method))
        throw new ApiError(405, 'MethodNotAllowed', `Use ${options.methods.join(' or ')} for this endpoint.`, undefined, {
          Allow: [...options.methods, 'OPTIONS'].join(', '),
        })

      let bucket = `ip:${clientIp(request)}`
      if (options.auth) {
        const keys = configuredKeys()
        if (!keys.length) throw new ApiError(503, 'ServiceUnavailable', 'The certificate API is not configured on this server.')
        const auth = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '')
        const key = auth ? matchKey(auth[1], keys) : null
        if (!key) {
          // Slow down key guessing from a single address.
          const limited = takeTokens(`fail:${clientIp(request)}`, 1, FAILED_AUTH_LIMIT)
          if (!limited.ok)
            throw new ApiError(429, 'TooManyRequests', 'Too many failed authentication attempts. Try again later.', undefined, {
              'Retry-After': String(limited.retryAfter),
            })
          throw new ApiError(
            401,
            'Unauthorized',
            auth ? 'The API key is invalid.' : 'Missing API key. Send "Authorization: Bearer <your API key>".',
            undefined,
            { 'WWW-Authenticate': 'Bearer realm="certificate-api"' },
          )
        }
        bucket = `key:${sha256(key).toString('hex').slice(0, 16)}`
      }

      const charge = (units: number) => {
        const r = takeTokens(bucket, units, rateLimit())
        if (!r.ok)
          throw new ApiError(429, 'TooManyRequests', `Rate limit exceeded (${rateLimit()} certificates per minute). Retry after ${r.retryAfter} s.`, undefined, {
            'Retry-After': String(r.retryAfter),
          })
      }
      charge(1)

      const ctx: HandlerContext = {
        request,
        requestId,
        url: new URL(request.url),
        charge,
        async readJson() {
          const type = request.headers.get('content-type') ?? ''
          if (!/^application\/json\b/i.test(type))
            throw new ApiError(415, 'UnsupportedMediaType', 'Send the certificate data as JSON with "Content-Type: application/json".')
          const text = await readLimitedBody(request, API_LIMITS.maxRequestBytes)
          if (!text.trim()) throw new ApiError(400, 'InvalidJSON', 'The request body is empty.')
          try {
            return JSON.parse(text) as unknown
          } catch {
            throw new ApiError(400, 'InvalidJSON', 'The request body is not valid JSON.')
          }
        },
      }
      return withHeaders(await handler(ctx))
    } catch (e) {
      if (e instanceof ApiError) return withHeaders(jsonResponse(e.toJSON(requestId), e.status, e.headers))
      console.error(`[certificate-api] ${requestId}`, e)
      return withHeaders(
        jsonResponse({ error: 'InternalError', message: 'The certificate could not be generated due to a server error.', requestId }, 500),
      )
    }
  }
}
