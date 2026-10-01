import { Zip, ZipDeflate } from 'fflate'
import { parseBatchRequest } from '../../src/lib/api/batch.js'
import { apiHandler } from '../_lib/http.js'
import { decodeImageInput } from '../_lib/images.js'
import { renderCertificatePdf } from '../_lib/render.js'

/**
 * POST /api/certificates/batch — shared fields + `certificates: [...]` in,
 * a ZIP of PDFs out (one per record, named after the participant).
 *
 * Every record is validated first; generation then streams the archive as
 * each PDF is produced, which keeps memory flat and the response clear of
 * the 4.5 MB buffered-response limit.
 */
const handle = apiHandler({ methods: ['POST'], auth: true }, async (ctx) => {
  const items = await parseBatchRequest(await ctx.readJson(), decodeImageInput)
  ctx.charge(items.length - 1) // one rate-limit unit per certificate

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err)
        controller.enqueue(chunk)
        if (final) controller.close()
      })
      void (async () => {
        try {
          for (const item of items) {
            const pdf = await renderCertificatePdf(item.config)
            const entry = new ZipDeflate(item.fileName, { level: 6 })
            zip.add(entry)
            entry.push(pdf.bytes, true)
          }
          zip.end()
        } catch (e) {
          console.error(`[certificate-api] ${ctx.requestId} batch generation failed`, e)
          controller.error(new Error('Batch generation failed'))
        }
      })()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="certificates.zip"',
      'Cache-Control': 'no-store',
      'X-Certificate-Count': String(items.length),
    },
  })
})

export default { fetch: handle }
