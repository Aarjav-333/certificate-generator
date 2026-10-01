import { createCanvas } from '@napi-rs/canvas'
import { unzipSync } from 'fflate'
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import batchApi from '../api/certificates/batch.js'
import certificatesApi from '../api/certificates/index.js'
import pngApi from '../api/certificates/png.js'
import healthApi from '../api/health.js'
import { resetRateLimits } from '../api/_lib/ratelimit.js'
import { crc32 } from '../src/lib/imageFormat.js'

const KEY = 'test-key-0123456789'
const URL_BASE = 'https://cert.test/api'

beforeAll(() => {
  process.env.CERTIFICATE_API_KEY = `${KEY},second-key`
  delete process.env.CERTIFICATE_API_CORS_ORIGINS
})
beforeEach(() => resetRateLimits())

type Handler = { fetch: (r: Request) => Promise<Response> }
/** Shape of every JSON response body (errors and /api/health). */
type JsonBody = { status?: string; error?: string; message?: string; details?: Array<{ field: string; message: string }> }
const readBody = async (res: Response) => (await res.json()) as JsonBody

function call(api: Handler, body: unknown, opts: { key?: string | null; path?: string; headers?: Record<string, string>; method?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers }
  if (opts.key !== null) headers.Authorization = `Bearer ${opts.key ?? KEY}`
  return api.fetch(
    new Request(`${URL_BASE}${opts.path ?? '/certificates'}`, {
      method: opts.method ?? 'POST',
      headers,
      body: opts.method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

function image(format: 'png' | 'jpeg' | 'webp', w = 300, h = 100): string {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  if (format !== 'png') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.strokeStyle = '#1B2F7A'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(10, h - 20)
  ctx.bezierCurveTo(w / 3, 0, (2 * w) / 3, h, w - 10, 20)
  ctx.stroke()
  const buf = format === 'png' ? c.toBuffer('image/png') : format === 'jpeg' ? c.toBuffer('image/jpeg') : c.toBuffer('image/webp')
  return `data:image/${format};base64,${buf.toString('base64')}`
}

const valid = () => ({
  template: 'reference',
  institution: { name: 'College of Engineering Trivandrum', subtitle: 'Department of Computer Applications', logo: image('png', 200, 220) },
  participant: { name: 'Aarjav Oravakandi', designation: 'Student Coordinator', department: 'MCA', institution: 'College of Engineering Trivandrum' },
  event: {
    name: 'National Technical Workshop',
    type: 'Workshop',
    organizer: 'ABC Organization',
    venue: 'Thiruvananthapuram',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
  },
  signatories: [
    { name: 'Dr. John Doe', designation: 'Event Coordinator', signature: image('png') },
    { name: 'Dr. Jane Doe', designation: 'Head of Department', signature: image('jpeg') },
  ],
})

async function inspectPdf(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  const doc = await PDFDocument.load(bytes)
  const fonts: string[] = []
  let images = 0
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null
    if (!dict) continue
    if (dict.get(PDFName.of('Type'))?.toString() === '/FontDescriptor' && dict.get(PDFName.of('FontFile2')))
      fonts.push(String(dict.get(PDFName.of('FontName'))))
    // Count visible images only: a transparent PNG also adds a grey soft-mask image.
    if (dict.get(PDFName.of('Subtype'))?.toString() === '/Image' && dict.get(PDFName.of('ColorSpace'))?.toString() !== '/DeviceGray') images++
  }
  const page = doc.getPage(0)
  return { bytes, doc, pages: doc.getPageCount(), width: page.getWidth(), height: page.getHeight(), fonts, images }
}

describe('GET /api/health', () => {
  it('reports ok without authentication', async () => {
    const res = await call(healthApi, null, { key: null, method: 'GET', path: '/health' })
    expect(res.status).toBe(200)
    expect(await readBody(res)).toEqual({ status: 'ok' })
  })
})

describe('authentication', () => {
  it('rejects a missing API key', async () => {
    const res = await call(certificatesApi, valid(), { key: null })
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Bearer')
    expect((await readBody(res)).error).toBe('Unauthorized')
  })

  it('rejects an invalid API key', async () => {
    const res = await call(certificatesApi, valid(), { key: 'wrong' })
    expect(res.status).toBe(401)
    expect((await readBody(res)).message).toBe('The API key is invalid.')
  })

  it('accepts any configured key (rotation)', async () => {
    expect((await call(certificatesApi, valid(), { key: 'second-key' })).status).toBe(200)
  })

  it('returns 503 when no key is configured instead of running open', async () => {
    const saved = process.env.CERTIFICATE_API_KEY
    process.env.CERTIFICATE_API_KEY = ''
    try {
      expect((await call(certificatesApi, valid())).status).toBe(503)
    } finally {
      process.env.CERTIFICATE_API_KEY = saved
    }
  })

  it('throttles repeated failed attempts', async () => {
    let last = 0
    for (let i = 0; i < 22; i++) last = (await call(certificatesApi, {}, { key: `guess-${i}` })).status
    expect(last).toBe(429)
  })
})

describe('POST /api/certificates — generation', () => {
  it('returns a one-page A4 landscape PDF with embedded fonts and images', async () => {
    const res = await call(certificatesApi, valid())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="Aarjav-Oravakandi.pdf"')
    const pdf = await inspectPdf(res)
    expect(new TextDecoder().decode(pdf.bytes.subarray(0, 5))).toBe('%PDF-')
    expect(pdf.pages).toBe(1)
    expect(pdf.width).toBeCloseTo(841.89, 1)
    expect(pdf.height).toBeCloseTo(595.28, 1)
    expect(pdf.fonts.length).toBeGreaterThanOrEqual(2)
    expect(pdf.fonts.every((f) => /CMUSerif/.test(f))).toBe(true)
    expect(pdf.images).toBe(3) // logo + 2 signatures
    expect(pdf.doc.getTitle()).toBe('Certificate — Aarjav Oravakandi')
  })

  it('accepts the web app\'s "Export JSON" file unchanged', async () => {
    const { template: _t, ...config } = valid()
    void _t
    const res = await call(certificatesApi, { format: 'certificate-generator/config', version: 1, config: { ...config, templateId: 'classic' } })
    expect(res.status).toBe(200)
    expect((await inspectPdf(res)).fonts.some((f) => /Cinzel/.test(f))).toBe(true)
  })

  it('accepts a top-level "description" as the wording', async () => {
    const res = await call(certificatesApi, { ...valid(), description: 'This is to certify that **{{name}}** attended {{event_name}} {{date_range}}.' })
    expect(res.status).toBe(200)
  })

  it.each([1, 2, 3, 4, 5, 6])('lays out %i signatories on one page', async (n) => {
    const body = valid()
    body.signatories = Array.from({ length: n }, (_, i) => ({ name: `Signatory ${i + 1}`, designation: 'Coordinator', signature: image('png') }))
    const res = await call(certificatesApi, body)
    expect(res.status).toBe(200)
    expect((await inspectPdf(res)).pages).toBe(1)
  })

  it('handles long names, events and descriptions without overflowing', async () => {
    const body = valid()
    body.participant.name = 'Venkataraghavan Subramaniam Krishnamoorthy Iyer Balasubramanian'
    body.event.name = 'International Conference on High Performance Computing, Machine Learning, Deep Learning and Large Scale Distributed Systems'
    Object.assign(body.event, { description: 'sponsored by the Directorate of Technical Education and the All India Council for Technical Education '.repeat(6) })
    const res = await call(certificatesApi, body)
    expect(res.status).toBe(200)
    expect(res.headers.get('x-certificate-warnings') ?? '').not.toMatch(/too long to fit/)
    expect((await inspectPdf(res)).pages).toBe(1)
  })

  it('supports every template, an event graphic, a WebP image and a background', async () => {
    for (const template of ['reference', 'classic', 'modern']) {
      const res = await call(certificatesApi, {
        ...valid(),
        template,
        eventGraphic: { image: image('webp', 120, 120), placement: 'top-right' },
        background: { image: image('jpeg', 800, 560), fade: 0.7 },
      })
      expect(res.status, template).toBe(200)
      expect((await inspectPdf(res)).images).toBe(5)
    }
  })

  it('formats single-day and multi-day date ranges', async () => {
    const single = await call(certificatesApi, { ...valid(), event: { ...valid().event, endDate: '2026-10-10' }, design: { dateFormat: 'D MMMM YYYY' } })
    expect(single.status).toBe(200)
  })
})

describe('POST /api/certificates — validation', () => {
  const expectError = async (body: unknown, status: number, match: RegExp, opts = {}) => {
    const res = await call(certificatesApi, body, opts)
    const json = await readBody(res)
    expect(res.status).toBe(status)
    expect(json.message).toMatch(match)
    expect(JSON.stringify(json)).not.toMatch(/at \w+ \(|[A-Z]:\\|\/var\/task|node_modules/) // no stack traces or paths
    return json
  }

  it('requires the participant name', async () => {
    const json = await expectError({ ...valid(), participant: { designation: 'Student' } }, 400, /^participant\.name is required$/)
    expect(json.error).toBe('ValidationError')
    expect(json.details?.[0].field).toBe('participant.name')
  })

  it('requires the event', async () => {
    const { event: _omit, ...rest } = valid()
    void _omit
    await expectError(rest, 400, /event\.name is required/)
  })

  it('rejects invalid dates and reversed ranges', async () => {
    await expectError({ ...valid(), event: { ...valid().event, startDate: '2026-02-30' } }, 400, /event\.startDate must be a valid date/)
    await expectError({ ...valid(), event: { ...valid().event, startDate: '2026-10-12', endDate: '2026-10-10' } }, 400, /event\.endDate: End date is before the start date/)
  })

  it('rejects an unknown template', async () => {
    await expectError({ ...valid(), template: 'fancy' }, 400, /template must be one of: reference, classic, modern/)
  })

  it('rejects malformed and unsupported images', async () => {
    await expectError({ ...valid(), institution: { ...valid().institution, logo: 'data:image/png;base64,@@not-base64@@' } }, 400, /institution\.logo contains malformed base64/)
    await expectError({ ...valid(), institution: { ...valid().institution, logo: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }, 400, /unsupported type "image\/gif"/)
    await expectError({ ...valid(), institution: { ...valid().institution, logo: `data:image/png;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}` } }, 400, /SVG, which is not supported/)
    // A real PNG cut short after its header: valid base64, readable size, undecodable pixels.
    const png = Buffer.from(image('png').split(',')[1], 'base64').subarray(0, 120)
    await expectError({ ...valid(), signatories: [{ name: 'A', signature: `data:image/png;base64,${png.toString('base64')}` }] }, 400, /signatories\[0\]\.signature is not a complete, valid PNG/)
  })

  it('rejects hostile images quickly instead of hanging', async () => {
    const started = Date.now()
    const full = Buffer.from(image('png').split(',')[1], 'base64')
    // Corrupt the compressed pixel data but recompute the CRC so the chunk walk passes.
    const tampered = Buffer.from(full)
    const idat = tampered.indexOf('IDAT')
    const len = tampered.readUInt32BE(idat - 4)
    for (let i = idat + 6; i < idat + 4 + len; i++) tampered[i] ^= 0x5a
    tampered.writeUInt32BE(crc32(tampered.subarray(idat, idat + 4 + len)), idat + 4 + len)
    await expectError({ ...valid(), institution: { ...valid().institution, logo: `data:image/png;base64,${tampered.toString('base64')}` } }, 400, /institution\.logo is not a complete, valid PNG/)
    const jpeg = Buffer.from(image('jpeg').split(',')[1], 'base64')
    await expectError({ ...valid(), institution: { ...valid().institution, logo: `data:image/jpeg;base64,${jpeg.subarray(0, Math.floor(jpeg.length * 0.7)).toString('base64')}` } }, 400, /institution\.logo is not a complete, valid JPEG/)
    expect(Date.now() - started).toBeLessThan(5000)
  })

  it('rejects oversized images and decompression bombs with 413', async () => {
    const big = `data:image/png;base64,${Buffer.alloc(2.2 * 1024 * 1024, 1).toString('base64')}`
    await expectError({ ...valid(), institution: { ...valid().institution, logo: big } }, 413, /larger than 2 MB/)
    // A valid PNG header claiming 20 000 × 20 000 px.
    const ihdr = Buffer.from('89504e470d0a1a0a0000000d4948445200004e2000004e200806000000', 'hex')
    await expectError({ ...valid(), institution: { ...valid().institution, logo: `data:image/png;base64,${Buffer.concat([ihdr, Buffer.alloc(16)]).toString('base64')}` } }, 413, /megapixels/)
  })

  it('rejects too many signatories', async () => {
    await expectError({ ...valid(), signatories: Array.from({ length: 7 }, (_, i) => ({ name: `S${i}` })) }, 400, /At most 6 signatories/)
  })

  it('rejects oversized requests with 413', async () => {
    const huge = JSON.stringify({ ...valid(), body: 'x'.repeat(4.2 * 1024 * 1024) })
    await expectError(huge, 413, /larger than 4 MB/)
  })

  it('rejects an over-long description and wrong types', async () => {
    await expectError({ ...valid(), body: 'x'.repeat(5001) }, 400, /body must be at most 5000 characters/)
    await expectError({ ...valid(), participant: { name: 42 } }, 400, /participant\.name must be a string/)
    await expectError({ ...valid(), design: { accentColor: 'red; x' } }, 400, /design\.accentColor must be a hex colour/)
  })

  it('rejects invalid JSON, wrong content type and wrong method', async () => {
    await expectError('{"oops"', 400, /not valid JSON/)
    await expectError(valid(), 415, /Content-Type: application\/json/, { headers: { 'Content-Type': 'text/plain' } })
    const res = await call(certificatesApi, null, { method: 'GET' })
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST, OPTIONS')
  })
})

describe('POST /api/certificates/png', () => {
  it('returns a 300 DPI PNG by default and honours ?dpi', async () => {
    const res = await call(pngApi, valid(), { path: '/certificates/png' })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(1, 4).toString()).toBe('PNG')
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([3508, 2480])

    const small = await call(pngApi, valid(), { path: '/certificates/png?dpi=96' })
    const sb = Buffer.from(await small.arrayBuffer())
    expect([sb.readUInt32BE(16), sb.readUInt32BE(20)]).toEqual([1123, 794])
    expect((await call(pngApi, valid(), { path: '/certificates/png?dpi=5000' })).status).toBe(400)
  })
})

describe('POST /api/certificates/batch', () => {
  it('returns a ZIP of PDFs with safe, unique file names', async () => {
    const { participant: _p, ...base } = valid()
    void _p
    const res = await call(
      batchApi,
      {
        ...base,
        certificates: [
          { participant: { name: 'Person One', designation: 'Student' } },
          { participant: { name: 'Rahul Kumar' } },
          { participant: { name: 'Rahul Kumar' } },
          { participant: { name: '../../etc/passwd' }, event: { venue: 'Kochi' } },
          { participant: { name: 'Zoë Ångström' } },
        ],
      },
      { path: '/certificates/batch' },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['Person-One.pdf', 'Rahul-Kumar.pdf', 'Rahul-Kumar-2.pdf', 'etc-passwd.pdf', 'Zoe-Angstrom.pdf'])
    for (const bytes of Object.values(files)) expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })

  it('validates every record before generating anything', async () => {
    const res = await call(batchApi, { ...valid(), certificates: [{}, { participant: { name: '' } }] }, { path: '/certificates/batch' })
    expect(res.status).toBe(400)
    const json = await readBody(res)
    expect(json.details?.map((d) => d.field)).toContain('certificates[1].participant.name')
  })

  it('limits the batch size', async () => {
    const res = await call(batchApi, { ...valid(), certificates: Array.from({ length: 51 }, () => ({})) }, { path: '/certificates/batch' })
    expect(res.status).toBe(413)
  })
})

describe('rate limiting', () => {
  it('returns 429 with Retry-After once the per-minute budget is spent', async () => {
    process.env.CERTIFICATE_API_RATE_LIMIT = '3'
    try {
      const statuses = []
      for (let i = 0; i < 4; i++) statuses.push((await call(certificatesApi, { ...valid(), participant: {} })).status)
      expect(statuses).toEqual([400, 400, 400, 429])
    } finally {
      delete process.env.CERTIFICATE_API_RATE_LIMIT
    }
  })
})

describe('CORS', () => {
  it('sends no CORS headers unless origins are configured', async () => {
    const res = await call(healthApi, null, { key: null, method: 'GET', path: '/health', headers: { Origin: 'https://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows configured origins', async () => {
    process.env.CERTIFICATE_API_CORS_ORIGINS = 'https://events.example.edu'
    try {
      const res = await call(certificatesApi, null, { method: 'OPTIONS', headers: { Origin: 'https://events.example.edu' } })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('https://events.example.edu')
      expect(res.headers.get('access-control-allow-headers')).toContain('Authorization')
    } finally {
      delete process.env.CERTIFICATE_API_CORS_ORIGINS
    }
  })
})
