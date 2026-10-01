import { parseCertificateRequest } from '../../src/lib/api/request.js'
import { apiHandler, binaryResponse, warningsHeader } from '../_lib/http.js'
import { decodeImageInput } from '../_lib/images.js'
import { renderCertificatePdf } from '../_lib/render.js'

/**
 * POST /api/certificates — certificate JSON in, single-page PDF out.
 * The JSON uses the same data model as the web app (its "Export JSON" file
 * is accepted as-is) and is rendered by the same template engine.
 */
const handle = apiHandler({ methods: ['POST'], auth: true }, async (ctx) => {
  const config = await parseCertificateRequest(await ctx.readJson(), decodeImageInput)
  const pdf = await renderCertificatePdf(config)
  return binaryResponse(pdf.bytes, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${pdf.baseName}.pdf"`,
    ...warningsHeader(pdf.warnings),
  })
})

export default { fetch: handle }
