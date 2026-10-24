---
name: freya
description: Create and maintain Freya presentations with YAML talks and Preact themes. Use for scaffolding slidesets, authoring slides, theme components, assets, offline presentations, PDF and editable PowerPoint exports, deployment, CLI extensions, and Freya maintenance.
---

# Freya

Freya extends Dante with YAML talks, Preact themes, browser navigation, offline loading, and HTML/PDF/PPTX exports. Use this self-contained skill for presentation projects and Freya development. Run `freya skills` or `freya skills freya` to print it, `freya skills dante` for the underlying engine, and `freya skills --list` to list both. All commands use normal CLI hooks; hook failures propagate. Install via skills.sh with `npx skills add ShogunPanda/freya --skill freya`.

## Workflow

1. Inspect the project's manifest, talks, themes, shared components and CLI extensions. Preserve its conventions and existing content.
2. Scaffold new projects from the examples below, adapting the talk ID and metadata. There is no `create-freya-slideset` command or bundled scaffolding directory.
3. Use Preact, not React, and import browser-facing APIs from `@perseveranza-pets/freya/client`. Keep content in YAML and layout/rendering in reusable theme components.
4. Run formatting, lint, CSS lint, type checking, and an HTML build. Inspect generated output and preview with the server. Dante logs some build errors without a nonzero exit code, so inspect logs and generated files too.
5. For exports, check the requested output format and theme annotations. Do not treat successful PPTX generation as proof of visual fidelity in PowerPoint.

## New presentation project

Require Node >=24.22.0 and an ESM package (`"type": "module"`), normally private at version `0.1.0`. Install `@perseveranza-pets/freya` and `preact` as direct dependencies. Install TypeScript, Prettier, ESLint, Stylelint, and the Cowtech configs as dev dependencies, selecting mutually compatible versions. When using ESLint 10, also install `@eslint/compat`. With TypeScript 7, retain a TypeScript 6 API package for ESLint as described in Verification below. Use the existing package manager for existing projects.

Recommended package scripts:

```json
{
  "dev": "freya development",
  "build": "freya build",
  "postbuild": "npm run lint && npm run lint:css && npm run typecheck",
  "server": "freya server",
  "pdf": "freya pdf",
  "pptx": "freya pptx",
  "deploy": "freya deploy",
  "format": "prettier -w src",
  "lint": "eslint --cache",
  "lint:css": "stylelint --cache 'src/**/*.css'",
  "typecheck": "tsc -p . --noEmit"
}
```

Create all these directories, including the empty common assets directory required by the build:

```text
src/
  talks/
    common.yml
    my-talk/
      info.yml
      slides.yml
      assets/
  themes/
    common/
      assets/
      components/common.tsx
    main/
      theme.yml
      theme.css
      assets/
      layouts/default.tsx
      components/common.tsx
```

Ignore `node_modules`, generated `dist`/`pptx`, and lint caches in Git. Do not add a generic Dante `src/build/index.ts`: Freya supplies its own builder and server through its launcher.

### `src/talks/common.yml`

```yaml
config:
  theme: main
  dimensions:
    width: 2000
    height: 1120
author:
  name: Your name
  description: ''
  email: ''
```

### `src/talks/my-talk/info.yml`

```yaml
config: common.config
document:
  title: My presentation
  author: common.author
```

`common.config` is resolved for the entire config; document values starting with `common.` reference top-level entries in `common.yml`. This is not a general YAML interpolation language.

### `src/talks/my-talk/slides.yml`

```yaml
---
title: Hello world!
content:
  - 'Edit **src/talks/my-talk/slides.yml**.'
notes: Speaker notes
---
layout: default
title: Next slide
content:
  - 'Add more slides as YAML documents separated by ---.'
```

The legacy `talk.yml` format contains `config`, `document`, and a `slides` array in one YAML document. A content string is normalized into an array. Missing slide options/classes become empty objects. Only boolean `disabled: true` excludes a slide; keep at least one active slide. `document.hidden` hides a talk from the index rather than disabling its slides. Layout-specific fields are defined by the theme.

### `src/themes/main/theme.yml`

```yaml
style: theme.css
urls: {}
fonts:
  sources: {}
  urls: []
  ranges: {}
  families: {}
```

Keep all font collection fields even when empty. Add `preloadImages` for images selected only at runtime and `layouts: { loading: loading }` to select an optional loading layout.

### `src/themes/common/components/common.tsx`

```tsx
import type { VNode } from 'preact'
import { useClient } from '@perseveranza-pets/freya/client'

export function Text({ text }: { text: string }): VNode {
  const { parseContent } = useClient()
  return <span data-pptx="text" dangerouslySetInnerHTML={{ __html: parseContent(text) }} />
}
```

### `src/themes/main/components/common.tsx`

```tsx
import type { SlideProps } from '@perseveranza-pets/freya/client'
import type { ComponentChildren, VNode } from 'preact'
import { cleanCssClasses, Progress, useClient, useSlide } from '@perseveranza-pets/freya/client'

interface SlideWrapperProps extends SlideProps {
  children: ComponentChildren
}

export function SlideWrapper({ className, style, children }: SlideWrapperProps): VNode {
  const { isExporting } = useClient()
  const { index } = useSlide()
  return (
    <article className={cleanCssClasses('freya@slide', className)} style={style} data-pptx="group">
      {children}
      {!isExporting && <Progress current={index} />}
    </article>
  )
}
```

### `src/themes/main/layouts/default.tsx`

```tsx
import type { Slide, SlideProps } from '@perseveranza-pets/freya/client'
import type { VNode } from 'preact'
import { cleanCssClasses, useSlide } from '@perseveranza-pets/freya/client'
import { Text } from '../../common/components/common.tsx'
import { SlideWrapper } from '../components/common.tsx'

export default function DefaultLayout({ className, style }: SlideProps): VNode {
  const {
    slide: { title, content }
  } = useSlide<Slide>()
  return (
    <SlideWrapper className={cleanCssClasses('theme@default', className)} style={style}>
      <h1>
        <Text text={title} />
      </h1>
      {(content ?? []).map((paragraph: string, index: number) => (
        <p key={index}>
          <Text text={paragraph} />
        </p>
      ))}
    </SlideWrapper>
  )
}
```

Layouts must export their renderer as default. Keep explicit `.tsx` extensions. Use `data-pptx="group"` on the wrapper and `data-pptx="text"` on text blocks so the same layout supports editable PPTX.

### `src/themes/main/theme.css`

```css
.freya\@slide {
  gap: 4rem;
  justify-content: center;
  padding: 10rem;
  color: #222;
  font-size: 4rem;

  & h1 {
    font-size: 8rem;
  }
}
```

### Tooling configuration

`tsconfig.json`:

```json
{
  "extends": "@cowtech/typescript-config",
  "compilerOptions": {
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

`eslint.config.js` for ESLint 10:

```js
import { cowtech } from '@cowtech/eslint-config'
import { fixupConfigRules } from '@eslint/compat'

export default [...fixupConfigRules(cowtech), { languageOptions: { parserOptions: { projectService: true } } }]
```

`.stylelintrc.json`:

```json
{
  "extends": ["@cowtech/stylelint-config"],
  "rules": {
    "unit-no-unknown": [true, { "ignoreUnits": ["/^--/"] }],
    "selector-class-pattern": null
  }
}
```

`prettier.config.js`:

```js
export default {
  printWidth: 120,
  semi: false,
  singleQuote: true,
  bracketSpacing: true,
  trailingComma: 'none',
  arrowParens: 'avoid'
}
```

## CLI and development lifecycle

- `freya dev` / `development` / `d`: build and serve on `0.0.0.0:4200`, watch `src`; `--ip` and `--port` customize binding.
- `freya build` / `b`: interactive HTML in `dist/html`.
- `freya server` / `serve` / `s`: serve existing output; `--directory` selects the output base (default `dist`). Freya serves its `html` subdirectory.
- The interactive builder currently targets project `dist/html` even with Dante's `--directory`; use the default for build/development. Export commands have their own output options.
- `freya --only my-talk,another-talk <command>` selects talks. `FREYA_WHITELIST` takes precedence. Options may precede the command, including development aliases.
- `freya font <url...> --ranges latin` inherits Dante's font metadata tool (YAML/CSS output, not font binary downloads).
- `freya pdf` / `p`: screenshot PDF per talk in `<directory>/pdf`, default directory `dist`; `--concurrency` defaults to 3 browsers and up to 3 tabs each, `--scale` defaults to 2 and must be a positive integer.
- `freya pptx` / `x`: editable PPTX per talk in `--directory` (default `pptx`), slide concurrency default 4.
- `freya deploy` / `y`: stage Netlify output at `<directory>/deploy`, default base `dist`. `--no-pdf` and `--no-pptx` disable those exports; `--concurrency` applies to both when supplied. Upload `site/` with the generated `netlify.toml`; the command itself does not upload.
- PDF/PPTX/deploy support `--force` to bypass cached exports. Network resources or installed fonts changing without input changes require forcing a rebuild.

Freya uses Dante >=3.1.0's Node launcher with explicit CLI/build/server URLs and `skills: { default: 'freya', files: { freya: absoluteSkillPath } }`. The built-in `dante` skill remains available. No shell `PATH` edits or argument-string parsing are needed.

Create `src/build/cli.ts` (or `.js`) for project commands, or override with `FREYA_CLI_PATH`:

```ts
import type { SetupCLI } from '@perseveranza-pets/freya'
import { developmentServerActive } from '@perseveranza-pets/freya'

export const setupCLI: SetupCLI = async (program, logger) => {
  program.command('hello').action(() => logger.info('Hello!'))
  if (developmentServerActive) {
    // Optional initialization specific to the watched development runtime.
  }
}
```

Register commands/options unconditionally. Dante first preloads TSX, then awaits Freya and project CLI hooks before parsing. The development action replaces the process via `execve` with watch enabled. Module imports, `setupCLI`, and `preAction` run first with `developmentServerActive === false`, then again in a fresh watched runtime with `true`. Other commands remain `false`. `true` is a lifecycle marker, not proof that the HTTP server is listening. Freya's talk-filter hook is safe to repeat; gate effects that must skip bootstrap on this boolean. Skill commands follow this same regular hook flow.

## Theme APIs, assets, and exports

Use `/client` for theme imports: `useSlide` exposes the current slide/index; `useClient` exposes presentation data and helpers such as `parseContent`, image resolution and loading state. Components include `Image`, `SVG`, `Code`, `Progress`, `QR`, navigation and presenter helpers. Server tooling and CLI types come from the package root, not `/client`. The root re-exports `developmentServerActive` and type-only Commander APIs.

Asset prefixes: `@talk/` resolves inside the talk's assets, `@theme/` inside the selected theme's assets, and `@common/` inside `src/themes/common/assets`. Extension-less local image resolution prefers `webp`, `svg`, `gif`, `png`, `jpg`, then `bmp`. Explicit extensions/remote URLs are preserved. Declare runtime-only images via `config.preloadImages` or theme `preloadImages`.

Use `loaded` to gate interaction and `loadingProgress` (optional percentage) for display. Production enables offline preparation by default; `FREYA_ENABLE_SERVICE_WORKER=true` enables it in development. `isExporting` suppresses progress/navigation; `exportingFormat` distinguishes HTML, PDF and PPTX.

PDF exports are images, one slide per page, without notes. PPTX keeps text editable, embeds declared Google Fonts when permitted, preserves SVGs as vectors, and includes speaker notes. Annotate existing layouts using `data-pptx="group|text|image|svg|shape|code|ignore"` as appropriate; these are individual accepted values, not a literal pipe-separated attribute. No annotations means PPTX export cannot proceed. Groups become independent objects, not native PowerPoint groups. Complex browser effects may differ in PowerPoint; Keynote may require local font installation.

Fonts for PPTX are downloaded from declared Google Fonts sources. Valid emoji sequences are preserved using viewer system fonts. `options.allowAllUnicodes: true` on a slide removes problematic invisible characters and permits viewer fallback for missing visible glyphs; it does not bypass missing font faces or embedding restrictions.

Environment: `FREYA_BUILD_VERSION` overrides Dante's timestamp version, `FREYA_WHITELIST` overrides talk selection, `FREYA_CLI_PATH` overrides the project CLI hook. Pusher requires `PUSHER_ENABLED=true` plus `PUSHER_KEY`, `PUSHER_SECRET`, and `PUSHER_CLUSTER`. Use standard `NODE_OPTIONS` for Node flags and `DANTE_WATCH_ADDITIONAL_PATHS` for comma-separated watch paths. `DANTE_WATCH_MODULES` watches Dante's installed module, not Freya; add Freya's path explicitly when needed. `DANTE_NODE_ADDITIONAL_OPTIONS` is legacy. The launcher explicitly selects Freya's CLI/build/server modules, overriding those `DANTE_*` path variables. There is no creation hook or `DANTE_CREATE_PATH` integration.

# Maintenance guide

## Documentation boundaries

- Keep `README.md` focused on presentation authors and theme authors: commands,
  configuration, public APIs, output characteristics and compatibility limits.
- Keep implementation details and maintenance invariants in this skill. Update this guide
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
- Freya's asynchronous `setupCLI` registers its commands before loading the consuming
  project's `setupCLI`, passing the same Commander program and Pino logger. Resolve
  `FREYA_CLI_PATH` from the working directory when set; otherwise prefer
  `src/build/cli.ts` over `src/build/cli.js`. Await the project hook before returning.
- This integration requires Dante to await its CLI hook before parsing arguments.
  Keep the public `SetupCLI` type and type-only Commander re-exports available from
  Freya so consuming projects do not need a direct Commander dependency.
- `src/configuration.ts` forwards `FREYA_BUILD_VERSION` to `DANTE_BUILD_VERSION` before
  build contexts are created. The Freya variable takes precedence when present.

## Slide and asset preparation

### Dante integration

- Freya's Node launcher selects its own build/server/CLI entry points. Do not describe
  a generic Dante site scaffold as the Freya installation workflow.
- Keep the slideset scaffold aligned with the current renderer: `theme.css`, complete
  empty font collections, common assets directory and a default-exported layout
  importing browser APIs from `/client`. Its layout includes PPTX annotations.
- Follow the real talks' structure with shared `talks/common.yml` metadata,
  a theme `SlideWrapper` and a shared Markdown `Text` component. Hide progress
  during exports through `isExporting`.
- Verify the documented scaffold by creating a temporary presentation project,
  then installing and building it using the local Freya package.
- Freya supplies Dante's build/server/CLI entry points. Its CLI then loads the
  consuming project's `setupCLI`; generic project build/server hooks are not chained.
- Build code can use Dante's `createFile` for `$hash` substitution. Build results
  can supply injected CSS. Server setup receives Fastify and a production boolean;
  CLI setup receives Commander and a Pino logger.
- Relevant inherited configuration includes `DANTE_BUILD_FILE_PATH`,
  `DANTE_SERVER_FILE_PATH`, `DANTE_CLI_PATH`,
  `DANTE_WATCH_MODULES`, `DANTE_WATCH_ADDITIONAL_PATHS`,
  `DANTE_NODE_ADDITIONAL_OPTIONS`, `DANTE_PROGRAM_NAME` and
  `DANTE_PROGRAM_DESCRIPTION`. Check launcher overrides before recommending them
  to users of Freya rather than Dante directly. Skill configuration lives in
  `bin/freya`; include `SKILL.md` and `AGENTS.md` in the published package.

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
- Do not add automated tests. For structural/launcher changes use build, lint,
  packaging inspection and targeted manual checks. Preserve existing tests.
- For exporter changes, fix `FREYA_BUILD_VERSION` and keep talk/theme/assets unchanged
  between runs. A fixed version alone does not freeze the source content.
- Compare PPTX ZIP integrity, XML, relationships, slide counts, text, geometry, images
  and embedded fonts. Normalize only known nondeterministic timestamps. If image bytes
  intentionally change, compare decoded dimensions/pixels rather than ignoring media.
- Automated structural checks are distinct from visual review in PowerPoint.
- Retain optimizations only with measured benefit and equivalent output. Experiments
  with cross-page SVG preview caching and sequentially awaited `canvas.toBlob()` did
  not improve the measured workload; avoid restoring them without new evidence.
