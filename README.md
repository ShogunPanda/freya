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

`theme.yml` selects `style: theme.css` and supplies `urls`, optional `layouts.loading`,
optional `preloadImages`, and `fonts`. Even an empty font collection should contain
`sources: {}`, `urls: []`, `ranges: {}`, and `families: {}`.

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
- `FREYA_WHITELIST`: comma-separated talk IDs, overriding `--only`.
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
