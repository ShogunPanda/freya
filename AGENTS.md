# Freya maintenance guide

## Documentation boundaries

- Keep `README.md` focused on presentation authors and theme authors: commands,
  configuration, public APIs, output characteristics and compatibility limits.
- Keep implementation details and maintenance invariants here. Update this guide
  when changing the behavior it describes; do not copy obsolete implementation notes.
- Preserve the README's sibling-package structure: package title and badges,
  description and homepage, installation/usage, then ESM, contributing and copyright.

## Architecture

- Freya extends Dante with YAML talks, Preact themes, interactive navigation and exports.
- `src/build.ts` remains Dante's interactive HTML builder entry point.
- `src/exports/html.ts` handles deployment HTML staging and shared static slide generation.
- `src/exports/pdf.ts` owns PDF preparation, rendering and assembly.
- `src/exports/pptx.ts` owns editable PowerPoint extraction, font embedding and finalization.
- `src/exports/deploy.ts` orchestrates HTML/PDF/PPTX and publishes selected artifacts.
- `src/exports/cache.ts` is the shared PDF/PPTX fingerprint and manifest implementation.
- `src/cli.ts` declares commands/options and delegates orchestration to these modules.
- `src/configuration.ts` forwards `FREYA_BUILD_VERSION` to `DANTE_BUILD_VERSION` before
  build contexts are created. The Freya variable takes precedence when present.

## Slide and asset preparation

### Dante integration

- Freya's CLI wrappers select its own build/server/CLI entry points. Do not describe
  a generic Dante site scaffold as the Freya installation workflow.
- Keep the slideset scaffold aligned with the current renderer: `theme.css`, complete
  empty font collections, common assets directory and a default-exported layout
  importing browser APIs from `/client`. Its layout includes PPTX annotations.
- Follow the real talks' structure with shared `talks/common.yml` metadata,
  a theme `SlideWrapper` and a shared Markdown `Text` component. Hide progress
  during exports through `isExporting`.
- Verify scaffolding into both a new directory and an existing empty directory,
  then install and build the generated project using the local Freya package.
- Dante's extension points include `build` in `src/build/index.ts`, `setupServer`
  in `src/build/server.ts`, `setupCLI` in `src/build/cli.ts` and `createSetupCLI`
  in `src/build/create.ts` in the consuming project. Preserve compatibility when
  changing Freya's integration with those hooks.
- Build code can use Dante's `createFile` for `$hash` substitution. Build results
  can supply injected CSS. Server setup receives Fastify and the build context;
  CLI/scaffolding setup receives Commander and a Pino logger.
- Relevant inherited configuration includes `DANTE_BUILD_FILE_PATH`,
  `DANTE_SERVER_FILE_PATH`, `DANTE_CLI_PATH`, `DANTE_CREATE_PATH`,
  `DANTE_WATCH_MODULES`, `DANTE_WATCH_ADDITIONAL_PATHS`,
  `DANTE_NODE_ADDITIONAL_OPTIONS`, `DANTE_PROGRAM_NAME` and
  `DANTE_PROGRAM_DESCRIPTION`. Check wrapper overrides before recommending them
  to users of Freya rather than Dante directly.

### Slides and images

- Filter only `disabled === true` in the talk loader, before normalization, counts,
  caching, layout loading and asset/code preparation. Support both YAML formats.
  Preserve relative order and consecutive numbering. Talks require an active slide.
- `imageExtensions` in `src/slidesets/loaders.ts` defines resolution precedence:
  `webp`, `svg`, `gif`, `png`, `jpg`, `bmp`. Explicit extensions are not searched or
  existence-checked by this resolution step; remote URLs pass through.
- Reuse the resolved filename for rendering, preload, offline cache and static exports.
  Missing extension-less references must report the searched paths.
- Collect image references during theme/slide rendering and deduplicate after
  resolution. Asset listings/copies still contain the complete library.
- Resolve `preloadImages` declarations per talk and populate the client resolver cache.
  Literal HTML/Markdown/CSS URLs bypass automatic resolver collection.
- Preserve `exportingFormat: 'html' | 'pdf' | 'pptx'` alongside `isExporting` in the
  client context. Themes pass the format to `ensureRenderedCode()`.
- Code cache keys must distinguish formats and exclude generated `rendered` content.
  Reusing a code object across formats must not reuse the wrong rendered result.
- Dante's tabular sanitizer inserts U+200C after ASCII borders for `language: none`.
  Strip those inserted controls immediately after sanitization for PPTX only.

## Export cache

- Use SHA-256 for both input fingerprints and output integrity. Store a formatted
  `cache.json` in each format's output directory, using the versioned manifest schema.
- Fingerprint talk-local source/assets plus shared `.env`, `src/talks/common.yml`,
  themes and scripts. Treat code/CSS under all talk directories as shared because
  talks can import components from other talks.
- Tree hashing excludes hidden entries, `__*` archives, `node_modules`, `summary.md`
  and `context.md`. Explicitly hashed `.env` remains an input.
- Include exporter settings, package versions, Node/platform/architecture/timezone
  and explicit build-version overrides. Concurrency is not a content input.
- Do not key the cache on the automatically generated timestamp: unchanged exports
  must remain reusable across invocations.
- Freya/Dante/export-library source edits without a package version bump require
  `--force`. Library sources, Chromium binaries, lockfiles and project package metadata
  are not hashed. External resource changes at the same URL also require `--force`.
- Resolve hits before HTML preparation and Chromium startup. Verify the artifact hash;
  missing/corrupt output or an invalid/unsupported manifest is a cache miss.
- Record fingerprints after successful artifact publication. Publish the manifest
  atomically from same-filesystem staging. Cache checks alone must not update it.
- Return selected cache hits along with newly exported IDs so deploy includes both.
  Never publish unrelated outputs or cache manifests.

## Export lifecycle and logging

- Keep temporary work isolated inside the output filesystem for atomic replacement.
  PDF uses `.freya-pdf-*`; PPTX uses `.pptx-*`. Clean up on success and failure.
- A failed talk must preserve its previous completed artifact. Never clear an export
  directory as a side effect of HTML generation; Dante's build needs isolated staging.
- Compile static CSS once per talk, with separate speaker-note styling. Static exports
  reference local assets via absolute `file://` URLs rather than copying the library.
- Keep PDF and PPTX intermediate/output directories independent.
- Route messages through Pino. Do not embed `INFO`, timestamps or logger formatting.
- Preserve preparation timings, per-talk progress/timings and total time including cleanup.
- Log verified cache hits at info level with a progress prefix and
  `Skipping exporting of slideset <id> as contents have not changed.`
- PPTX talk errors carry `[current/total] Error while exporting slideset <id>:` plus
  slide context when known. Avoid redundant nested error prefixes.
- Fidelity details use debug, not warn. Emit them after the talk summary with a
  separate counter and `Slide N:`. Indent by the talk progress prefix width plus one.
- Generic font resolution and ordinary emoji fallback are expected, not warnings.
  Do not emit JSON fidelity reports or reintroduce benchmark-only timers/counters.
- Successful PPTX publication removes only that talk's legacy `.pptx-fonts.zip`
  and `.pptx-report.json` sidecars.

## PDF implementation

- Preserve screenshot-based output: one page per slide at the configured dimensions,
  no margins or speaker notes. Scale changes raster resolution, not page dimensions.
- Use Playwright Chromium and reusable per-tab CDP sessions with
  `Page.captureScreenshot`, JPEG quality 95 and `optimizeForSpeed: true`.
  Embed JPEG buffers without recompression/downsampling; Chromium owns chroma subsampling.
- Concurrency bounds both browser count and tabs per browser. Each browser processes
  a talk, then takes another after assembly and cleanup; reuse tabs within its context.
- Wait for fonts and decoded images, including CSS backgrounds and SVG resources.
  Finish finite animations, cancel infinite ones and hide carets before capture.
- Drain workers and close browsers on failure. Preserve talk/slide error context.

## PPTX implementation

- Reuse the existing static HTML, Preact layouts and computed CSS; do not introduce
  separate PowerPoint templates or whole-slide rasterization.
- Read `data-pptx` annotations without duplicating nested objects. `ignore` excludes
  subtrees. Require at least one annotation per slide. Groups are independent objects.
- Keep text editable using browser-measured fragments. Uniform, unwrapped code uses
  one rich-text box and a separate numbering box; preserve whitespace, indentation,
  blank lines, highlighting/opacity and distinct line backgrounds. Omit redundant
  opaque token backgrounds. Fall back to fragments for nonuniform/clipped code.
- XML rewriting must preserve whitespace-only runs, remove duplicate paragraph
  properties and retain explicit rich-text line breaks.
- Use a 13⅓-inch-wide canvas and scale coordinates consistently with the talk's aspect ratio.
- Preserve SVG files/backgrounds as vectors using viewport sizing/clipping; expand
  local `<use>` references, including leaf images. Keep Chromium PNG compatibility
  previews and both SVG/PNG relationships. Do not convert paths to native shapes.
- Attach hyperlinks to text shapes so Office link themes cannot override CSS styling.
- Reuse original PNG/JPEG bytes for uncropped images needing no pixel reduction.
  Otherwise use canvas PNG crops, capped at 4096 pixels on the longest side.
  CSS scaling alone does not require resampling original images.
- Skip additional ZIP deflation for already compressed raster formats; keep DEFLATE
  for other parts. This preserves content with a modest file-size tradeoff.
- Download complete static TrueType faces from declared Google Fonts sources. Measure
  with the same faces in Chromium and embed EOT `.fntdata`. Respect embedding permissions
  and font metadata for typeface/weight/style associations; do not subset to slide text.
- Share downloaded immutable font data across talks in one invocation. Download missing
  faces with a limit of four; assign aliases in document order, not completion order.
  Load only the current slide's required faces in Chromium.
- Keep Unicode emoji editable and delegate fallback to the viewer. Preserve valid emoji
  sequences. Default-ignorable controls outside them normally fail; with
  `options.allowAllUnicodes === true`, remove them from exported text and permit
  viewer fallback for missing visible glyphs. Other font failures still propagate.
- Slide concurrency is configurable, default four. Overlap navigation and extraction,
  serialize font preparation through ordered gates and assemble slides in source order.
  Settle each batch before error propagation/cleanup, including failed gate holders.

## Service worker and loading

- Prepare declared fonts before mounting, with a ten-second bound; failures must not
  prevent mounting. Handle both pending and already-fired `DOMContentLoaded`.
- Normalize bare talk URLs to the first numbered slide with `location.replace()`
  before mounting. Preserve query/hash and skip redirects for exports. A bare
  `/<talk>` document is outside the `/<talk>/` worker scope.
- While waiting, render the loading layout (or first slide fallback) using first-slide
  data; preserve an explicitly requested slide for completion. Disable navigation,
  synchronization and client actions except fullscreen while not loaded.
- `loadingProgress` is optional even before completion. Use `loaded` as the readiness
  signal; SSR/exports are ready. Progress counts attempted resources, including failures.
- Precache resolved talk images and declared fonts; discover font files and imports
  from external CSS. Deduplicate URLs and update totals when dependencies are discovered.
  Talk HTML retains font preloads rather than global image preloads.
- The talk worker is self-contained. Prepare up to four resources concurrently, with
  30-second per-fetch timeouts and a versioned cache. Wait for both queued and active work.
- Subscribe after obtaining the matching controller. Reply with current state, send
  progress heartbeats every second and completion after all resources are attempted.
  Payload fields are `talk`, `version`, `total`, `processed`, `downloaded`, `cached`, `failed`.
- Validate controller, talk and version on receipt. Forward matching progress/completion
  messages as `freya:preload` window events using the message as `event.detail`.
- Unsupported/disabled workers and registration failures skip waiting. A 30-second
  watchdog proceeds when status is absent; heartbeats renew it. Reopened pages subscribe
  again and restarted workers rebuild state from cache. Failed resources can retry
  during rendering; completion does not promise complete offline availability.

## Verification

- Keep TypeScript 7's compiler installed as `@typescript/native` and the TypeScript 6
  compatibility API aliased as `typescript` for typescript-eslint. Builds use `tsc`;
  lint tooling imports `typescript` because TypeScript 7 does not expose that API.
- Wrap the Cowtech ESLint preset with `@eslint/compat` while its legacy plugins
  depend on rule APIs removed in ESLint 10.
- `npm test` is a placeholder, not evidence of verification. The cache regression
  suite is `node --test test/export-cache.test.ts`.
- For exporter changes, fix `FREYA_BUILD_VERSION` and keep talk/theme/assets unchanged
  between runs. A fixed version alone does not freeze the source content.
- Compare PPTX ZIP integrity, XML, relationships, slide counts, text, geometry, images
  and embedded fonts. Normalize only known nondeterministic timestamps. If image bytes
  intentionally change, compare decoded dimensions/pixels rather than ignoring media.
- Automated structural checks are distinct from visual review in PowerPoint.
- Retain optimizations only with measured benefit and equivalent output. Experiments
  with cross-page SVG preview caching and sequentially awaited `canvas.toBlob()` did
  not improve the measured workload; avoid restoring them without new evidence.
