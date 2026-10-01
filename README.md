# Certificate Generator

A reusable certificate generator with two ways in:

- **Web app.** Fill in the institution, participant, event and signatory details, write the wording with `{{placeholders}}`, and download a print-ready **A4 PDF** or a **300 DPI PNG/JPG**. You can also generate a whole batch from a CSV file. Everything in the web app runs in your browser: uploaded logos, signatures and saved configurations never leave your device.
- **HTTP API.** Other systems (for example a college event-management system) can `POST` certificate data and receive the finished PDF, PNG or a ZIP of PDFs. No browser is involved.

Both use the **same data model and the same rendering engine**, so a certificate generated through the API is identical to one downloaded from the web app.

**Live app:** https://certificate-generator-six-tau.vercel.app
**API base URL:** https://certificate-generator-six-tau.vercel.app/api

## Features

- **Certificate templates.** *Institutional* (modelled on a LaTeX-typeset institutional certificate), *Classic* (ornate frame, engraved capitals, script name) and *Modern* (accent bands, tracked sans labels). New templates are a single file.
- **Live preview.** Every keystroke re-renders the certificate at its exact A4 geometry.
- **Institution logo upload.** PNG, JPG, WebP or SVG, adjustable height, never stretched.
- **Event graphic upload.** An optional emblem, badge or first-letter graphic, placed in a corner, above the title or as a watermark. There is also an optional washed-out background photo.
- **Participant information.** Salutation, name, designation, department, institution.
- **Event information.** Name, type, organizer, venue, start/end/issue dates with nine date formats (including superscript ordinals such as 20ᵗʰ).
- **Custom certificate description.** Write your own wording with light markup: `*italic*`, `**bold**`, `***bold italic***`, `^{sup}`, and `# display line`.
- **Dynamic placeholders.** `{{name}}`, `{{designation}}`, `{{department}}`, `{{institution}}`, `{{event_name}}`, `{{event_type}}`, `{{organizer}}`, `{{venue}}`, `{{start_date}}`, `{{end_date}}`, `{{date}}`, `{{description}}` and more. It also supports filters (`{{name|upper}}`) and conditional sections (`{{#venue}}, held at {{venue}}{{/venue}}`).
- **Multiple signatories.** 1–6 signatories. One is centred, 2–5 sit in one row, and 6 are laid out in two rows (or choose the arrangement yourself). Signatories can be reordered.
- **Signature upload.** Size and position controls, show/hide, automatic trimming, and one-click white-background removal for scanned signatures.
- **PDF export.** A single-page vector PDF at exact A4 size (297 × 210 mm) with embedded fonts and selectable text.
- **PNG export.** Rendered at 300 DPI (3508 × 2480 px), not a screenshot. JPG and browser **Print** are also available.
- **Batch from CSV.** Upload a CSV with one participant per row and download a ZIP of PDFs. It uses the current design, wording, logos and signatories, and works entirely in the browser.
- **Certificate API.** Single PDF, PNG and batch ZIP endpoints with API-key authentication. See [API](#api).
- **Save/load certificate configuration.** Named saves in the browser (IndexedDB) and draft autosave, plus **Export/Import JSON** to reuse configurations anywhere. An exported JSON file can be sent to the API unchanged.
- **Reset and clear.** *Reset form* restores the template's sample values (with undo). *Clear everything* asks for confirmation first.
- **Validation.** Required fields, date ranges, template syntax, unsupported, corrupt, truncated or oversized images, and overflowing text are all reported clearly.
- **Responsive generator UI.** A two-panel layout on desktop that stacks on tablet and mobile, with accessible labels, keyboard navigation and focus management.

### How the preview matches the PDF

The certificate is never laid out by the browser. A small layout engine (`src/lib/layout`) measures text with the actual font files (via fontkit) and does the line breaking, justification, kerning and auto-fit. It then outputs a **display list** of positioned primitives in PDF points, with an explicit x-coordinate for every character. Thin renderers draw that list: SVG for the preview, pdf-lib for the PDF, and Canvas for PNG/JPG (the browser canvas in the web app, Skia via `@napi-rs/canvas` on the server).

The engine has no browser dependencies, so the API runs exactly the same code on Vercel Functions. For the same input, the web app and the API produce PDFs with identical text positions and pixel-identical rendering. Long names or descriptions first tighten the template's spacing and then reduce the text size, so content never overflows or spills onto a second page.

## API

The API turns certificate JSON into a finished certificate. It is stateless (nothing is stored) and runs on Vercel Functions.

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/health` | `{"status":"ok"}` (no authentication) |
| `POST` | `/api/certificates` | One certificate as `application/pdf` |
| `POST` | `/api/certificates/png` | The same certificate as `image/png` (300 DPI, or `?dpi=72…300`) |
| `POST` | `/api/certificates/batch` | Many certificates as `application/zip` (one PDF per record) |

### Authentication

Every endpoint except `/api/health` requires an API key in the `Authorization` header:

```text
Authorization: Bearer YOUR_API_KEY
```

A missing or wrong key gets `401 Unauthorized`. The key is configured on the server through the `CERTIFICATE_API_KEY` environment variable, never in the code. If no key is configured, the API refuses all requests with `503` rather than running unprotected.

### Request

Send `Content-Type: application/json`. The body uses the web app's own certificate model; every section is optional except where marked **required**. Anything you leave out falls back to the chosen template's defaults (fonts, colours, wording, layout).

```json
{
  "template": "reference",
  "institution": {
    "name": "College of Engineering Trivandrum",
    "subtitle": "Department of Computer Applications",
    "department": "",
    "logo": "data:image/png;base64,iVBORw0KGgo...",
    "logoSize": 70
  },
  "participant": {
    "salutation": "Shri.",
    "name": "Aarjav Oravakandi",
    "designation": "Student Coordinator",
    "department": "MCA",
    "institution": "College of Engineering Trivandrum"
  },
  "event": {
    "name": "National Technical Workshop",
    "type": "three-day workshop",
    "organizer": "ABC Organization",
    "venue": "Thiruvananthapuram",
    "startDate": "2026-10-10",
    "endDate": "2026-10-12",
    "description": "sponsored by the Directorate of Technical Education"
  },
  "body": "This is to certify that ***{{salutation}} {{name|upper}},*** *{{affiliation}}* has participated in the {{event_type}} on “{{event_name}}”, organized by {{organizer}}, held at {{venue}} {{date_range}}.",
  "issueDate": "2026-10-12",
  "signatories": [
    { "name": "Dr. John Doe", "designation": "Event Coordinator", "signature": "data:image/png;base64,iVBORw0KGgo..." },
    { "name": "Dr. Jane Doe", "designation": "Head of Department", "signature": "data:image/jpeg;base64,/9j/4AAQ..." }
  ],
  "eventGraphic": { "image": "data:image/webp;base64,UklGR...", "placement": "top-right", "size": 64, "opacity": 1 },
  "background": { "image": "data:image/jpeg;base64,/9j/4AAQ...", "fade": 0.72 },
  "design": { "dateFormat": "Do^ MMM YYYY", "accentColor": "#262A6B" }
}
```

| Field | Notes |
| --- | --- |
| `template` | `reference` (default), `classic` or `modern`. `templateId` is accepted too. |
| `institution.name` | **required**. Other institution fields are `subtitle`, `department`, `logo` and `logoSize` (20–160 pt). |
| `participant.name` | **required**. Other participant fields are `salutation`, `designation`, `department` and `institution`. |
| `event.name` | **required**. Other event fields are `type`, `organizer`, `venue`, `startDate`, `endDate` (`YYYY-MM-DD`, end ≥ start) and `description`. |
| `body` | The certificate wording with `{{placeholders}}` and markup (see [Features](#features)). A top-level `"description"` string is accepted as an alias. If omitted, the template's default wording is used. Maximum 5000 characters. |
| `title`, `titleTagline` | For example `"Certificate"` and `"of Participation"`. |
| `issueDate` | Fills `{{date}}`. |
| `signatories[]` | 0–6 entries of `{ name (required), designation, organization, signature, showSignature, signatureScale, signatureOffsetX, signatureOffsetY }`. They are laid out exactly as in the web app. |
| `eventGraphic` | `{ image, placement: top-left \| top-right \| above-title \| watermark, size, opacity }`. |
| `background` | `{ image, fade: 0–1 }`. |
| `design` | Any of `primaryFont`, `secondaryFont`, `displayFont` (`cmu-serif`, `eb-garamond`, `libre-baskerville`, `playfair-display`, `cinzel`, `montserrat`, `great-vibes`), `headingColor`, `accentColor`, `textColor`, `borderColor`, `backgroundColor` (hex), `bodyAlign`, `bodyFontSize`, `headingFontSize`, `titleFontSize`, `borderStyle` (`none`, `single`, `double`, `thick-thin`, `ornate`), `borderWidth`, `signatureLayout` (`auto`, `one-row`, `two-rows`), `showSignatureLines` and `dateFormat`. |

**Images** (`logo`, `signature`, `eventGraphic.image`, `background.image`) are base64 **data URLs** (`data:image/png;base64,...`). PNG, JPEG and WebP are supported (WebP is converted to PNG). Each image may be up to **2 MB** and 25 megapixels, and must be a complete, valid file. The aspect ratio is always preserved.

**Tip:** design a certificate in the web app, click **Export JSON**, and send that file to the API as it is. Only change the participant fields per request.

### Response

On success the API returns `200` with the file as the body:

- `/api/certificates` returns `Content-Type: application/pdf`: a valid, single-page A4 landscape PDF with embedded fonts and selectable text.
- It also returns `Content-Disposition: attachment; filename="Aarjav-Oravakandi.pdf"`.
- `X-Certificate-Warnings` is present only if the layout had to adapt, for example "Certificate text was reduced from 14.4pt to 12pt so it fits".
- `X-Request-Id` identifies the request; quote it when reporting a problem.

### cURL example

```bash
curl -X POST https://certificate-generator-six-tau.vercel.app/api/certificates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @certificate.json \
  --output certificate.pdf
```

### JavaScript example

```javascript
const response = await fetch("https://certificate-generator-six-tau.vercel.app/api/certificates", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.CERTIFICATE_API_KEY}`,
  },
  body: JSON.stringify(certificateData),
});

if (!response.ok) {
  const { error, message, details } = await response.json();
  throw new Error(`${response.status} ${error}: ${message}`);
}

const pdfBlob = await response.blob(); // or: Buffer.from(await response.arrayBuffer()) in Node.js
```

### PNG endpoint

`POST /api/certificates/png` accepts the same body and returns `image/png`. The default is 300 DPI (3508 × 2480 px). Use `?dpi=150` for a smaller image (72–300).

### Batch API

`POST /api/certificates/batch` generates up to **50 certificates** per request and returns a ZIP. Fields at the top level are shared by every certificate. Each entry in `certificates` overrides them: `institution`, `participant`, `event`, `eventGraphic`, `background` and `design` are merged field by field, and other fields (for example `signatories`) are replaced.

```json
{
  "template": "reference",
  "institution": { "name": "College of Engineering Trivandrum", "logo": "data:image/png;base64,..." },
  "event": { "name": "Workshop", "venue": "Kochi", "startDate": "2026-10-10", "endDate": "2026-10-10" },
  "signatories": [{ "name": "Dr. John Doe", "designation": "Coordinator" }],
  "certificates": [
    { "participant": { "name": "Person One", "designation": "Student" } },
    { "participant": { "name": "Person Two", "designation": "Student" } }
  ]
}
```

```bash
curl -X POST https://certificate-generator-six-tau.vercel.app/api/certificates/batch \
  -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_API_KEY" \
  -d @batch.json --output certificates.zip
```

The ZIP contains `Person-One.pdf`, `Person-Two.pdf`, and so on.
- File names are built only from letters and digits of the participant's name (accents are stripped), so they can never contain paths.
- Duplicate names get `-2`, `-3`, ….
- All records are validated before anything is generated; one invalid record fails the request with details such as `certificates[3].participant.name`.
- Shared images are decoded once.

### Errors

Errors are JSON and never contain stack traces, file paths or secrets:

```json
{
  "error": "ValidationError",
  "message": "participant.name is required",
  "details": [{ "field": "participant.name", "message": "participant.name is required" }],
  "requestId": "4c1f0e0a-…"
}
```

| Status | `error` | When |
| --- | --- | --- |
| 400 | `ValidationError` | Missing required fields, invalid dates or ranges, unknown template, wrong types, malformed or unsupported images, more than 6 signatories, wording longer than 5000 characters. `details` lists every problem. |
| 400 | `InvalidJSON` | The body is empty or not valid JSON. |
| 401 | `Unauthorized` | Missing or invalid API key. |
| 404 | (Vercel) | Unknown path. |
| 405 | `MethodNotAllowed` | Wrong HTTP method (see the `Allow` header). |
| 413 | `PayloadTooLarge` | Request over 4 MB, an image over 2 MB or 25 megapixels, or a batch over 50 certificates. |
| 415 | `UnsupportedMediaType` | `Content-Type` is not `application/json`. |
| 429 | `TooManyRequests` | Rate limit exceeded (see the `Retry-After` header). |
| 500 | `InternalError` | Unexpected server error. The details are logged under the `requestId`. |
| 503 | `ServiceUnavailable` | The server has no API key configured. |

### Limits and rate limiting

| Limit | Value |
| --- | --- |
| Request body | 4 MB (Vercel Functions accept at most 4.5 MB) |
| Single image | 2 MB decoded, 25 megapixels |
| Signatories | 6 |
| Certificates per batch | 50 |
| Wording (`body`) | 5000 characters |
| Rate limit | 60 certificates per minute per API key (a batch counts each certificate), adjustable with `CERTIFICATE_API_RATE_LIMIT` |
| Failed authentication | 20 per minute per IP address |

How the rate limit works:
- It is kept in each function instance's memory. No database is needed, but it is a **per-instance, best-effort** limit: Vercel can run several instances in parallel, so the effective global limit can be higher.
- It stops runaway scripts and casual abuse.
- For a strict global limit, add a rate-limit rule in Vercel's firewall (Project → Firewall), with no code changes.

### CORS

The API is meant to be called from servers (your event-management backend). Browsers cannot call it cross-origin by default. If a browser application must call it directly, list its origins in `CERTIFICATE_API_CORS_ORIGINS`. Keep in mind that an API key shipped to a browser is visible to anyone using that page.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `CERTIFICATE_API_KEY` | yes (for the API) | Secret key callers send as `Authorization: Bearer …`. Several comma-separated keys allow rotation without downtime. |
| `CERTIFICATE_API_RATE_LIMIT` | no | Certificates per minute per key per instance (default 60). |
| `CERTIFICATE_API_CORS_ORIGINS` | no | Comma-separated browser origins allowed to call the API (default: none). |

On Vercel, set them under Project → Settings → Environment Variables (or with `vercel env add CERTIFICATE_API_KEY production`). Locally, copy `.env.example` to `.env.local`. Never commit real keys.

To generate a strong key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 8](https://vite.dev) (build tooling and dev server)
- [Tailwind CSS 4](https://tailwindcss.com) (generator UI styling)
- [pdf-lib](https://pdf-lib.js.org) + [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) (PDF generation, font embedding and text measurement, in the browser and on the server)
- [Vercel Functions](https://vercel.com/docs/functions) (Node.js) for the API
- [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) (server-side PNG rendering and WebP decoding, using prebuilt Skia binaries)
- [fflate](https://github.com/101arrowz/fflate) (ZIP archives for batch output, in the browser and on the server)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB persistence)
- [Vitest](https://vitest.dev) (unit and API tests) and [Oxlint](https://oxc.rs) (linting)
- Fonts (all SIL Open Font License, bundled in `public/fonts`): CMU Serif (Computer Modern), EB Garamond, Libre Baskerville, Playfair Display, Cinzel, Montserrat, Great Vibes

## Local Development

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173). `npm run dev` serves only the web app.

To run the web app **and the API** locally, use the [Vercel CLI](https://vercel.com/docs/cli) with a local key:

```bash
CERTIFICATE_API_KEY=local-dev-key vercel dev
```

Other scripts:

```bash
npm test            # unit tests and API tests (Vitest); API tests call the real handlers
npm run lint        # Oxlint (src, api, tests)
npm run typecheck   # TypeScript: web app, Vite config, and the server code (with no DOM types)
```

## Build

```bash
npm run build     # type-checks everything, then builds the web app to dist/
npm run preview   # serves the production build locally
```

## Deployment

The app is deployed on **[Vercel](https://vercel.com)** at https://certificate-generator-six-tau.vercel.app. The Vercel project is connected to this GitHub repository: every push to `main` triggers a production deployment, and pushes to other branches get preview deployments.

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Functions | `api/**` (Node.js), configured in `vercel.json` |

`vercel.json` does two things:
- It bundles the font files into the certificate functions. They are read from disk by name, which Vercel's file tracing cannot detect.
- It sets per-endpoint time limits (30 s for a PDF, 60 s for PNG, 300 s for a batch).

`CERTIFICATE_API_KEY` must be set in the project's environment variables for the API to work.

## Project Structure

```
api/                     Vercel Functions (the HTTP API)
  health.ts              GET /api/health
  certificates/
    index.ts             POST /api/certificates → PDF
    png.ts               POST /api/certificates/png → PNG
    batch.ts             POST /api/certificates/batch → ZIP
  _lib/                  Server-only helpers (not routes): auth, CORS, rate limit, errors,
                         font loading from disk, image decoding/validation, PDF/PNG rendering
tests/                   API tests (real handlers, real PDFs/PNGs/ZIPs)
public/fonts/            Bundled TTF fonts (same files for preview, PDF, PNG and the API)
src/
  App.tsx                App shell: state, section layout, export/validation flow
  components/            UI: header (save/load/import/export/reset/clear), preview panel
    sections/            Form sections: template, institution, participant, event, wording,
                         graphics, signatories, design, batch from CSV
    ui/                  Accessible primitives: inputs, dialog, image upload, toasts
  templates/             Certificate templates + the composition engine (shared by web and API)
    engine.ts            Turns config + template into a display list (layout, auto-fit)
    reference.ts …       Template definitions (geometry, typography, default design/wording)
    borders.ts           Border and ornament drawing
  lib/
    api/                 Platform-neutral API logic: request validation, batch merging,
                         safe file names, CSV parsing, limits and error types
    layout/              Display list types, text measurement/kerning, paragraph layout
    render/              SVG (preview), PDF (pdf-lib), shared canvas drawer, browser canvas
    text/                {{placeholder}} expansion and rich-text markup parsing
    fonts/               Font registry, platform-neutral font parsing, browser loader
    imageFormat.ts       PNG/JPEG/WebP sniffing, dimensions and structural validation
    images.ts            Browser upload processing: SVG/WebP rasterisation, trimming, background removal
    config.ts            Defaults, template switching, JSON import/export sanitisation
    storage.ts           IndexedDB drafts and saved configurations
    validation.ts        Field and export validation (shared by the form and the API)
    exporter.ts          Browser PDF / PNG / JPG export
  data/                  Sample data and generated sample assets (crest, signatures)
  hooks/                 State, live layout and autosave hooks
  types/                 Certificate data model (shared by web and API)
  utils/                 Dates, colours, downloads, data URLs
```

Code under `src/` that the API imports (templates, layout, text, PDF renderer, config, validation) must not use browser APIs. A separate TypeScript project (`tsconfig.api.json`, with no DOM types) checks this on every build.

### Adding a template

Create `src/templates/<name>.ts` exporting a `TemplateDefinition`: its page size, margins, header order, typographic specs, signature geometry, default design and wording, and optionally a `decorate` function. Then add it to `TEMPLATES` in `src/templates/index.ts`. It becomes available in the web app and the API at the same time.
