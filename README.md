# @perseveranza-pets/freya

[![Version](https://img.shields.io/npm/v/@perseveranza-pets/freya.svg)](https://npm.im/@perseveranza-pets/freya)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@perseveranza-pets/freya)](https://libraries.io/npm/@perseveranza-pets/freya)

Opinionated JSX based slides generator.

https://sw.cowtech.it/freya

## Installation

Require **Node.js >=24.22.0** and an ESM project (`"type": "module"`). Freya uses Dante ^3.1.0.

Print the complete agent skill to create or maintain a presentation project:

```bash
npx @perseveranza-pets/freya skills
```

Or install the skill through [skills.sh](https://skills.sh):

```bash
npx skills add ShogunPanda/freya --skill freya
```

[SKILL.md](./SKILL.md) contains the complete Preact/YAML scaffold, reusable components,
tooling configurations, and maintenance workflow. The `create-freya-slideset` executable
and bundled scaffolding templates have been removed. Ask your agent to use the skill,
or create the documented files yourself. The skill command only prints instructions.

To add Freya to an existing presentation project:

```bash
npm install @perseveranza-pets/freya preact
```

## Usage

Freya combines YAML slide content with Preact layouts and CSS themes. A project can
contain multiple talks sharing the same themes and assets.

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
      layouts/
        default.tsx
      components/common.tsx
      assets/
```

Create `src/themes/common/assets` even when empty: the builder copies it. Layouts
default-export Preact components; use shared Markdown text and slide wrapper components
as shown in the skill. Freya supplies its own build and server, so a project does not
need a generic Dante build entry point.

Run commands from the presentation project's root:

```bash
npx freya development
npx freya build
npx freya server
```

Use `--only` to select talks, or omit it to include all talks:

```bash
npx freya --only my-talk,another-talk build
```

### Commands and skills

| Command               | Aliases      | Purpose                                                        |
| --------------------- | ------------ | -------------------------------------------------------------- |
| `freya development`   | `dev`, `d`   | Build, watch `src`, and serve with live reload                 |
| `freya build`         | `b`          | Generate interactive HTML                                      |
| `freya server`        | `serve`, `s` | Serve existing output                                          |
| `freya pdf`           | `p`          | Export screenshot PDFs                                         |
| `freya pptx`          | `x`          | Export editable PowerPoint presentations                       |
| `freya deploy`        | `y`          | Stage Netlify HTML/PDF/PPTX output                             |
| `freya font <url...>` | `f`          | Print font metadata as YAML and CSS; `--ranges` filters ranges |
| `freya skills [name]` |              | Print an agent skill                                           |

```bash
freya skills         # Freya (default)
freya skills freya   # Freya explicitly
freya skills dante   # Underlying Dante engine
freya skills --list  # Both registered IDs
```

Skills are printed without headers. All commands run the normal CLI hooks, including
skill commands; an invalid project hook prevents execution. `--help` shows command
options. Development and server accept `--ip` (default `0.0.0.0`) and `--port`
(default `4200`). Server accepts `--directory` for the output base and serves its
`html` subdirectory. The interactive builder currently writes to project `dist/html`
even when Dante's inherited `--directory` option is supplied; use the default for
build/development. Export commands use their own documented directory options.

### Custom commands

Create `src/build/cli.ts` (or `src/build/cli.js`) exporting a `setupCLI` function:

```ts
import type { SetupCLI } from '@perseveranza-pets/freya'

export const setupCLI: SetupCLI = (program, logger) => {
  program
    .command('hello')
    .description('Run a custom command')
    .action(() => {
      logger.info('Hello!')
    })
}
```

Freya calls this hook after registering Dante's and its own commands, using the same
Commander program and Pino logger. The hook can add commands, customize existing
commands and options, and be asynchronous; it is awaited before argument parsing.
Freya uses Dante's public launcher and asynchronous CLI integration.

Set `FREYA_CLI_PATH` to load a different file, resolved from the project's root.
Otherwise, Freya checks `src/build/cli.ts` before `src/build/cli.js`. Projects without
a CLI customization file continue to use the standard commands.

Freya also re-exports Commander's types, including `Command` and `Option`, so projects
can import them with `import type` from `@perseveranza-pets/freya` without declaring
a direct Commander dependency. These exports are types only, not runtime constructors.

### Development lifecycle

The Node entry point passes Freya's CLI/build/server modules to Dante's launcher.
Dante preloads TSX, loads CLI extensions, and lets Commander parse all options before
enabling watch from the development action. Arguments containing spaces are preserved;
global options can precede the command, e.g. `freya --only my-talk dev`.

```ts
import { developmentServerActive } from '@perseveranza-pets/freya'
```

This boolean is available at import time and during `setupCLI` and `preAction`.
It is `false` in the initial bootstrap, then `true` in the watched development runtime.
CLI modules and hooks therefore execute in both phases; register commands/options
unconditionally and gate development-only side effects when needed. Other commands
remain `false`. `true` does not mean the HTTP server is already listening. Freya's
talk-selection hook is safe to repeat. Watch restarts also reconstruct the CLI.

### Slides

Configure the theme, slide dimensions and document metadata in `info.yml`:

```yaml
config:
  theme: main
  dimensions:
    width: 2000
    height: 1120
document:
  title: My presentation
  author:
    name: Your name
```

Define slides in `slides.yml`, using the layouts and fields supported by your theme.
The legacy single-file `talk.yml` format is also supported.

Multiple slides in `slides.yml` are YAML documents separated by `---`. The legacy
format instead uses a `slides` array alongside `config` and `document`. Layout names
select files in the theme's `layouts` directory; omitted names use `default`.
Content fields are theme-defined; a string `content` is normalized into an array.
Use `notes` for speaker notes.

Shared values can live in `src/talks/common.yml`: `config: common.config` selects its
entire `config` object, and document values such as `author: common.author` reference
top-level shared entries. These are specific supported references, not general interpolation.

Set `disabled: true` on a slide to exclude it from the presentation and all exports:

```yaml
---
layout: default
disabled: true
```

Only the YAML boolean `true` disables a slide. Remaining slides keep their order
and are numbered consecutively after rebuilding. Keep at least one active slide
per talk. To hide a whole talk from the index instead, use `document.hidden`.

### Images

Local image references can use `@talk/`, `@theme/` and `@common/` prefixes. You can
omit the extension, for example `@talk/architecture` or `@theme/logo`. Freya chooses
the first existing file in this order: `webp`, `svg`, `gif`, `png`, `jpg`, `bmp`.
Use an explicit extension to select a particular format. Remote URLs are unchanged.

Images resolved by the theme are automatically included in the talk's preload and
offline cache. For runtime-only images or literal URLs that bypass the image
resolver, declare `preloadImages` under the talk's `config` or at the top level of
`theme.yml`:

```yaml
preloadImages:
  - '@theme/logo-light'
  - '@theme/logo-dark'
```

### Loading layout

Published presentations prepare their offline resources before enabling navigation.
If some resources fail, the presentation can still open, but those resources may
not be available offline.

To customize the loading screen, add a layout in the theme's `layouts` directory
and reference it in `theme.yml`:

```yaml
layouts:
  loading: loading
```

Without a loading layout, Freya uses the first slide's normal layout. Theme
components can read `loaded: boolean` and `loadingProgress?: number` through
`useClient()`. Progress is a percentage between 0 and 100 when available; it can be
absent during the initial wait. Use `loaded` to determine whether loading is over.

## Theme configuration and public APIs

### Project-owned 404 page

Create `src/pages/404.tsx` with a default-exported renderer. Freya passes Dante's
`BuildContext`, awaits the result, renders the complete Preact document, and writes
`404.html` alongside the presentation pages, with an HTML doctype.

```tsx
import type { BuildContext } from '@perseveranza-pets/dante'
import type { VNode } from 'preact'

export default function Page404(context: BuildContext): VNode {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Not found</title>
      </head>
      <body>
        <h1>Not found</h1>
        <p>Build {context.version}</p>
      </body>
    </html>
  )
}
```

The renderer may be asynchronous. The project owns the markup, metadata and CSS:
Freya injects no stylesheet, reset, variables or fonts into this page. Inline your
own CSS (for example, read a sibling `404.css` from the renderer), or explicitly
publish any linked assets. Development still uses Dante's live-reload injection.
If the renderer is absent, Freya generates `404.html` as
`<!doctype html><html><head></head><body></body></html>`, served with HTTP 404.
A present renderer that fails is a build error.
The same renderer ownership and missing-renderer behavior applies to index, asset
and speaker-note pages. Freya no longer supplies default templates for these pages.

### Project-owned index

Create `src/pages/index.tsx` and default-export a `PageRenderer<'index'>`:

```tsx
import type { PageRenderer } from '@perseveranza-pets/freya'
import { compileCSS } from '@perseveranza-pets/freya'

const Index: PageRenderer<'index'> = async (context, { talks, common, script }) => {
  const css = await compileCSS(new URL('./style.css', import.meta.url), context)

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Talks</title>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </head>
      <body>
        <h1>Talks</h1>
        {Object.entries(talks)
          .filter(([, talk]) => !talk.document.hidden)
          .map(([id, talk]) => <p key={id}><a href={`/${id}`}>{talk.document.title}</a></p>)}
      </body>
    </html>
  )
}

export default Index
```

Freya writes `index.html`, served at `/`. The second argument contains:

- `talks: Record<string, Talk>`: talks selected for this build, keyed by ID.
  The renderer decides how to filter `document.hidden`, group `document.archived`,
  and sort the entries.
- `common: Record<string, object>`: shared metadata from `src/talks/common.yml`.
- `script: string`: site-version initialization and service-worker registration
  when enabled. Insert it into a `<script>` element to retain that behavior.

Create the sibling `style.css` used by the example. Freya injects no default CSS
or font preloads into this page. Dante handles development live reload separately.

### Project-owned asset listing

Create `src/pages/assets.tsx` and default-export a `PageRenderer<'assets'>`.
It receives `(context, { theme, talk, commonImages, themeImages, talkImages })`:

- `theme: Theme` and `talk: Talk`: the resolved theme and talk.
- `commonImages`, `themeImages`, `talkImages`: `string[]` asset identifiers,
  prefixed with `@common/`, `@theme/`, and `@talk/` respectively.

Convert identifiers to preview URLs with
`resolveImageUrl(cache, theme.id, talk.id, id)`, where `cache` is a
`Record<string, string>` shared within the render. Keep the original identifier
for copy-to-clipboard controls. The renderer owns markup, CSS, and any browser
scripts for searching or copying identifiers.

In development, Freya renders this page for each selected talk, writes
`<talk>_assets.html`, and serves it at `/<talk>/assets`. Asset listings are not
generated by production builds. As with the index, a missing renderer produces
the empty HTML document; a present renderer that fails is a build error.

Both renderers return a complete Preact document, synchronously or asynchronously.
Freya adds the doctype. Use `PageData['index']` or `PageData['assets']` when you
need the data types separately from `PageRenderer`.

### Project-owned speaker notes

Create `src/pages/speaker-notes.tsx` with a default export of type
`PageRenderer<'speaker-notes'>`. The renderer receives `(context, { talk })` and
returns a complete Preact document. Use `renderNotes(slide)` to render Markdown
notes and `compileCSS` to load project-owned styles.

During static slide preparation, Freya generates `<talk>/speaker-notes.html` for
talks containing notes. A missing renderer produces an empty HTML document;
an existing renderer that fails is a build error. No styles are injected by Freya.
In development, each selected talk also has a preview at `/<talk>/speaker-notes`,
served from `<talk>_speaker-notes.html`, following the development-only assets listing.

### Compiling project CSS

For local SVGs in server-rendered pages, use `SvgFile` from
`@perseveranza-pets/freya`:

```tsx
<SvgFile path={new URL('./assets/background.svg', import.meta.url)} className="background" />
```

It inlines the SVG without requiring a slide context. `path` accepts a file URL
or a string resolved against the project working directory. SVG props can override
the file's root attributes; source width and height are omitted. The existing
`Svg` component remains intended for slide assets.

`compileCSS(path, context)` is exported from `@perseveranza-pets/freya` for server-side
page renderers and build code. It returns CSS text, not an HTML `<style>` element:

```tsx
import { compileCSS } from '@perseveranza-pets/freya'

const css = await compileCSS(new URL('./pages.css', import.meta.url), context)
// Inside your page renderer:
// <style dangerouslySetInnerHTML={{ __html: css }} />
```

The path accepts a file URL or a string resolved against the project working directory.
The context needs `isProduction`; a complete Dante `BuildContext` can be passed.
The helper shares Freya's import expansion, class-name escaping, custom units and
`@color` visitor, then uses Lightning CSS with minification in production. It does
not automatically load any resets, variables, fonts, layers or theme styles.

Use standalone quoted import lines with `@freya/` for bundled styles or `@./` for
paths rooted in the project's `src` directory, including nested imports:

```css
@import '@freya/variables.css';
@import '@./pages/shared.css';

.resources {
  margin: 20--pt;
  padding: 0.5--sp;
  font-family: var(--freya-font-main);
}
```

`1--pt` becomes `2.7px`; `1--sp` becomes `200px`. CSS custom properties remain native
browser variables. `@color accent freya-color-accent;` produces the corresponding
`theme@fg-accent` and `theme@bg-accent` utility classes. This standalone helper has
no talk/theme context, so use `@./themes/...` rather than `@theme/` or `@talk/`.
Ordinary relative imports such as `./shared.css` are not expanded by this resolver.

Configure custom aliases through `context.extensions.freya.cssImports` before calling
`compileCSS`:

```ts
context.extensions.freya.cssImports = {
  foo: '~/Development/Private/sites/www/src/assets/styles'
}
```

```css
@import '@foo/application.css';
```

Keys omit `@` and `/`; `freya`, `theme`, `talk` and `.` are reserved. Directories
must be absolute, with a leading `~/` expanded to the current user's home directory.
Nested imports use the same aliases. `@#` filesystem imports are no longer supported.

### Theme configuration

`theme.yml` selects `style: theme.css` and supplies `urls`, optional `layouts.loading`,
optional `preloadImages`, and `fonts`. Even an empty font collection should contain
`sources: {}`, `urls: []`, `ranges: {}`, and `families: {}`.

Freya includes no web fonts by default. Its interface uses `--freya-font-main`
(default: the system font stack) and `--freya-font-mono` (default: the system
monospace stack). Override these CSS variables in your theme to customize typography.

The UI accent is `--freya-color-accent` (default `#5ac3ea`); slide and presentation
backgrounds use `--freya-slide-background` (white) and
`--freya-presentation-background` (black). The theme stylesheet is selected by
`theme.yml`'s `style`, falling back to `theme.css`. Optional `variables.css`,
`reset.css`, and `colors.css` in the theme and `talk.css` in the talk are also loaded.

Slide width/height and minimum sizes use `--freya-slide-width` and
`--freya-slide-height`, initialized from the talk's configured dimensions. Their CSS
defaults are `2000px` and `1120px`; change the talk dimensions to keep layout and
JavaScript scaling aligned. The initial transform is `scale(1)`. Navigator and
presenter hide slide progress using `--freya-display-progress: none`.

Freya controls have a visible keyboard focus outline using the accent color. The
reset preserves native focus outlines for other content. Resource grids adapt their
column count to the available width.

Browser-facing layouts import from `@perseveranza-pets/freya/client`, which keeps
server-only dependencies out of browser bundles:

- `useSlide()` provides the current slide and index; `Slide`, `SlideProps` and
  `SlideRenderer` describe theme data/renderers.
- `useClient()` provides talk/theme data, content/image helpers, `loaded`, optional
  `loadingProgress`, `isProduction`, `isExporting`, and `exportingFormat`.
- `Image`, `SVG`, `Code`, `QR`, `Progress`, navigation and presenter components support
  reusable layouts; `cleanCssClasses` combines conditional class names.
- Hide interactive progress/navigation during exports using `isExporting`.

Use the package root for server-side build/rendering/loaders, CLI types, and
`developmentServerActive`. Do not import the root into browser components.

## Exporting

| Command        | Result                                        | Default output           |
| -------------- | --------------------------------------------- | ------------------------ |
| `freya build`  | Interactive HTML presentations                | `dist/html/`             |
| `freya pdf`    | One image-based PDF per talk                  | `dist/pdf/<talk-id>.pdf` |
| `freya pptx`   | One editable PowerPoint presentation per talk | `pptx/<talk-id>.pptx`    |
| `freya deploy` | HTML, PDF and PPTX prepared for Netlify       | `dist/deploy/`           |

PDF and PPTX exports automatically reuse unchanged presentations. Use `--force`
to regenerate them, including after changing remote resources at the same URL or
system fonts. Deleting an export's output directory also clears its cache.
Cache hits are reported in the terminal. A failed export does not replace that
talk's previous completed file.

### PDF

```bash
npx freya --only my-talk pdf
npx freya pdf --directory output --concurrency 2 --scale 3
```

Each PDF contains one slide per page, preserving the slide dimensions and order,
without speaker notes. Pages are images rather than editable text.

- `-d, --directory <path>`: base output directory; PDFs go in its `pdf/` subdirectory. Default: `dist`.
- `-c, --concurrency <number>`: maximum browsers and maximum tabs per browser. Default: `3`; a value of `3` permits up to nine simultaneous slides across talks.
- `-s, --scale <number>`: positive integer image-density multiplier. Default: `2`. Higher values improve resolution but use more memory and produce larger images; page dimensions stay unchanged.
- `--force`: regenerate selected PDFs even when cached.

### PowerPoint

```bash
npx freya --only my-talk pptx
npx freya pptx --directory output/pptx --concurrency 2
```

Text remains editable, SVGs remain vector images, and speaker notes are included.
Freya preserves the slide order and aspect ratio. Some text is split into separate
boxes to match the browser layout; complex CSS effects may not reproduce exactly.

- `-d, --directory <path>`: output directory. Default: `pptx`.
- `-c, --concurrency <number>`: maximum concurrent slide pages. Default: `4`.
- `--force`: regenerate selected PPTXs even when cached.

#### Theme support

PPTX export requires `data-pptx` annotations in the theme's existing layouts:

```tsx
<article className="freya@slide" data-pptx="group">
  <h1 data-pptx="text">An editable title</h1>
  <img data-pptx="image" src={imageUrl} />
</article>
```

`group` includes descendants. Use `text`, `image`, `svg`, `shape` and `code` for
specific blocks, or `ignore` to exclude a subtree. Annotations do not change the
HTML appearance. A theme without annotations cannot be exported to PPTX.
Exported groups are independent objects, not PowerPoint groups; SVG paths are not
converted to native PowerPoint shapes.

#### Fonts and Unicode

PPTX generation needs network access to download the Google Fonts declared in
Freya and the theme's `fonts.sources`. Fonts are embedded for editing in compatible
PowerPoint versions, without requiring a local installation. Generic system font
stacks use the theme's default declared family. Emoji use the viewer's system fonts
and may look different across platforms.

**Apple Keynote:** embedded PPTX fonts may not be available to Keynote. Install
matching fonts locally to avoid missing-font substitutions.

Unexpected invisible Unicode characters and visible characters missing from the
selected font normally stop the export. To allow a particular slide to export:

```yaml
options:
  allowAllUnicodes: true
```

This removes unwanted invisible characters from the exported text and lets the
viewer choose a fallback for missing visible characters. Valid emoji sequences
are preserved; YAML source files are not changed. Missing font faces or fonts
that prohibit editable embedding still cause an error.

## Deployment

```bash
npx freya deploy
npx freya --only my-talk deploy --concurrency 2
npx freya deploy --no-pptx
```

The deploy command prepares files for Netlify; it does not upload them. HTML, PDF
and PPTX are enabled by default.

- `-d, --directory <path>`: base output directory. Default: `dist`.
- `-p, --no-pdf`: exclude PDF generation and publication.
- `-x, --no-pptx`: exclude PPTX generation and publication. Use both exclusions for HTML only.
- `-c, --concurrency <number>`: apply the same concurrency value to PDF and PPTX. When omitted, each keeps its own default: PDF `3`, PPTX `4`.
- `--force`: regenerate selected PDF and PPTX files instead of reusing cached output.

Upload `dist/deploy/site/` using the generated `dist/deploy/netlify.toml` configuration.
PDFs are published under `/pdfs` and PPTXs under `/pptx`. Only selected talks are
included, whether newly generated or reused from cache. Cache files are not published.
Configured Netlify functions are included in the deployment output.

## Environment variables

- `FREYA_BUILD_VERSION`: fix the site version for reproducible builds and exports. Normally the version is generated automatically; change or unset a fixed version when publishing updated content.
- `FREYA_CLI_PATH`: override the consuming project's CLI hook, relative to the working directory or absolute.
- `FREYA_WHITELIST`: comma-separated talk IDs, combined with `-o`/`--only` (duplicates removed).
- `FREYA_ENABLE_SERVICE_WORKER=true`: enable offline preparation during development; production builds enable it by default.
- `PUSHER_ENABLED=true`: enable Pusher synchronization. Requires `PUSHER_KEY`, `PUSHER_SECRET` and `PUSHER_CLUSTER`.
- `NODE_OPTIONS`: standard Node startup flags, inherited through the launcher.
- `DANTE_WATCH_ADDITIONAL_PATHS`: comma-separated additional development watch paths.
- `DANTE_WATCH_MODULES`: when nonempty, watch the installed Dante module. To watch Freya itself, add its path through `DANTE_WATCH_ADDITIONAL_PATHS`.
- `DANTE_NODE_ADDITIONAL_OPTIONS`: legacy extra Node flags; prefer `NODE_OPTIONS`.

The launcher explicitly sets Freya's CLI/build/server modules; `DANTE_CLI_PATH`,
`DANTE_BUILD_FILE_PATH`, and `DANTE_SERVER_FILE_PATH` do not override those choices.
Use `FREYA_CLI_PATH` for project CLI extensions. Freya does not chain project
`src/build/index.ts` or `src/build/server.ts` hooks. The removed scaffolder no longer
uses `DANTE_CREATE_PATH`.

## ESM Only

This package only supports direct imports in an ESM context.

For information on using it in a CommonJS context, please check [this page](https://gist.github.com/ShogunPanda/fe98fd23d77cdfb918010dbc42f4504d).

## Contributing to freya

- Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
- Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
- Fork the project.
- Start a feature/bugfix branch.
- Commit and push until you are happy with your contribution.
- Run `pnpm run build` for TypeScript compilation, ESLint and Stylelint. Use targeted manual checks for changed behavior; `npm test` is currently a placeholder.
- Read [SKILL.md](./SKILL.md) for maintenance invariants and the scaffolding workflow. Keep it synchronized with the README and implementation; do not add automated tests.

## Copyright

Copyright (C) 2022 and above Shogun (shogun@cowtech.it).

Licensed under the ISC license, which can be found at https://choosealicense.com/licenses/isc.
