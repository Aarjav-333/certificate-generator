import { apiHandler, jsonResponse } from './_lib/http.js'

/** GET /api/health — confirms the function runtime is up. No secrets, no details. */
const handle = apiHandler({ methods: ['GET'], auth: false }, async () => jsonResponse({ status: 'ok' }, 200))

export default { fetch: handle }
