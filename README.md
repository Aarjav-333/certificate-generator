# Certificate Generator

A reusable, browser-based certificate generator. Fill in the institution, participant, event and signatory details, write the certificate wording with `{{placeholders}}`, and download a print-ready **A4 PDF** or a **300 DPI PNG/JPG**. The live preview and the exported files come from the same layout engine, so what you see is exactly what you get.

Everything runs in the browser. Uploaded logos, signatures and saved configurations stay on your device and are never sent to a server.

**Live app:** https://certificate-generator-six-tau.vercel.app

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
- **Save/load certificate configuration.** Named saves in the browser (IndexedDB) and draft autosave, plus **Export/Import JSON** to reuse configurations anywhere.
- **Reset and clear.** *Reset form* restores the template's sample values (with undo). *Clear everything* asks for confirmation first.
- **Validation.** Required fields, date ranges, template syntax, unsupported, corrupt or oversized images, and overflowing text are all reported clearly.
- **Responsive generator UI.** A two-panel layout on desktop that stacks on tablet and mobile, with accessible labels, keyboard navigation and focus management.

### How the preview matches the PDF

The certificate is never laid out by the browser. A small layout engine (`src/lib/layout`) measures text with the actual font files (via fontkit) and does the line breaking, justification, kerning and auto-fit. It then outputs a **display list** of positioned primitives in PDF points, with an explicit x-coordinate for every character. Three thin renderers draw that list: SVG for the preview, pdf-lib for the PDF, and Canvas for PNG/JPG. Long names or descriptions first tighten the template's spacing and then reduce the text size, so content never overflows or spills onto a second page.

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite 8](https://vite.dev) (build tooling and dev server)
- [Tailwind CSS 4](https://tailwindcss.com) (generator UI styling)
- [pdf-lib](https://pdf-lib.js.org) + [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) (PDF generation, font embedding and text measurement)
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) (IndexedDB persistence)
- [Vitest](https://vitest.dev) (unit tests) and [Oxlint](https://oxc.rs) (linting)
- Fonts (all SIL Open Font License, bundled in `public/fonts`): CMU Serif (Computer Modern), EB Garamond, Libre Baskerville, Playfair Display, Cinzel, Montserrat, Great Vibes

## Local Development

Requires Node.js 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

Other scripts:

```bash
npm test            # unit tests (Vitest)
npm run lint        # Oxlint
npm run typecheck   # TypeScript project build check
```

No environment variables are required.

## Build

```bash
npm run build     # type-checks, then builds to dist/
npm run preview   # serves the production build locally
```

The output in `dist/` is a fully static site.

## Deployment

The app is deployed on **[Vercel](https://vercel.com)** at https://certificate-generator-six-tau.vercel.app. With the Vercel GitHub integration connected to this repository, every push to `main` triggers a production deployment. A manual production deploy is `vercel deploy --prod`. The project uses these settings:

| Setting          | Value           |
| ---------------- | --------------- |
| Framework        | Vite            |
| Build command    | `npm run build` |
| Output directory | `dist`          |

No `vercel.json` or environment variables are needed.

## Project Structure

```
public/fonts/            Bundled TTF fonts (same files for preview, PDF and PNG)
src/
  App.tsx                App shell: state, section layout, export/validation flow
  components/            UI: header (save/load/import/export/reset/clear), preview panel
    sections/            Form sections: template, institution, participant, event, wording,
                         graphics, signatories, design
    ui/                  Accessible primitives: inputs, dialog, image upload, toasts
  templates/             Certificate templates + the composition engine
    engine.ts            Turns config + template into a display list (layout, auto-fit)
    reference.ts …       Template definitions (geometry, typography, default design/wording)
    borders.ts           Border and ornament drawing
  lib/
    layout/              Display list types, text measurement/kerning, paragraph layout
    render/              SVG (preview), PDF (pdf-lib) and Canvas (PNG/JPG) renderers
    text/                {{placeholder}} expansion and rich-text markup parsing
    fonts/               Font registry and loader
    images.ts            Upload validation, SVG/WebP rasterisation, trimming, background removal
    config.ts            Defaults, template switching, JSON import/export sanitisation
    storage.ts           IndexedDB drafts and saved configurations
    validation.ts        Field and export validation
    exporter.ts          PDF / PNG / JPG export orchestration
  data/                  Sample data and generated sample assets (crest, signatures)
  hooks/                 State, live layout and autosave hooks
  types/                 Certificate data model
  utils/                 Dates, colours, downloads, data URLs
```

### Adding a template

Create `src/templates/<name>.ts` exporting a `TemplateDefinition`: its page size, margins, header order, typographic specs, signature geometry, default design and wording, and optionally a `decorate` function. Then add it to `TEMPLATES` in `src/templates/index.ts`.
