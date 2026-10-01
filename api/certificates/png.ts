import { ApiError } from '../../src/lib/api/errors.js'
import { API_LIMITS } from '../../src/lib/api/limits.js'
import { parseCertificateRequest } from '../../src/lib/api/request.js'
import { apiHandler, binaryResponse, warningsHeader } from '../_lib/http.js'
import { decodeImageInput } from '../_lib/images.js'
import { renderCertificatePng } from '../_lib/render.js'

/**
 * POST /api/certificates/png[?dpi=300] — same input as /api/certificates,
 * returns a PNG rendered from the same display list (300 DPI by default,
 * i.e. 3508 × 2480 px for A4 landscape).
 */
const handle = apiHandler({ methods: ['POST'], auth: true }, async (ctx) => {
  const dpiParam = ctx.url.searchParams.get('dpi')
  const dpi = dpiParam === null ? API_LIMITS.maxPngDpi : Number(dpiParam)
  if (!Number.isInteger(dpi) || dpi < API_LIMITS.minPngDpi || dpi > API_LIMITS.maxPngDpi)
    throw new ApiError(400, 'ValidationError', `dpi must be a whole number between ${API_LIMITS.minPngDpi} and ${API_LIMITS.maxPngDpi}`, [
      { field: 'dpi', message: `dpi must be a whole number between ${API_LIMITS.minPngDpi} and ${API_LIMITS.maxPngDpi}` },
    ])
  const config = await parseCertificateRequest(await ctx.readJson(), decodeImageInput)
  const png = await renderCertificatePng(config, dpi)
  return binaryResponse(png.bytes, {
    'Content-Type': 'image/png',
    'Content-Disposition': `attachment; filename="${png.baseName}.png"`,
    ...warningsHeader(png.warnings),
  })
})

export default { fetch: handle }
