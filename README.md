# @perseveranza-pets/freya

[![Version](https://img.shields.io/npm/v/@perseveranza-pets/freya.svg)](https://npm.im/@perseveranza-pets/freya)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@perseveranza-pets/freya)](https://libraries.io/npm/@perseveranza-pets/freya)

Opinionated JSX based slides generator.

https://sw.cowtech.it/freya

## Installation

Create a presentation project:

```bash
npx --package=@perseveranza-pets/freya -- create-freya-slideset my-talk
cd my-talk
npm install
npm run dev
```

To add Freya to an existing project:

```bash
npm install @perseveranza-pets/freya
```

## Usage

Freya combines YAML slide content with Preact layouts and CSS themes. A project can
contain multiple talks sharing the same themes and assets.

```text
src/
  talks/
    my-talk/
      info.yml
      slides.yml
      assets/
  themes/
    main/
      theme.yml
      style.css
      layouts/
      assets/
```

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
- `FREYA_WHITELIST`: comma-separated talk IDs, overriding `--only`.
- `FREYA_ENABLE_SERVICE_WORKER=true`: enable offline preparation during development; production builds enable it by default.
- `PUSHER_ENABLED=true`: enable Pusher synchronization. Requires `PUSHER_KEY`, `PUSHER_SECRET` and `PUSHER_CLUSTER`.

## ESM Only

This package only supports direct imports in an ESM context.

For information on using it in a CommonJS context, please check [this page](https://gist.github.com/ShogunPanda/fe98fd23d77cdfb918010dbc42f4504d).

## Contributing to freya

- Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
- Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
- Fork the project.
- Start a feature/bugfix branch.
- Commit and push until you are happy with your contribution.
- Make sure to add tests for it. This is important so existing functionality isn't broken unintentionally.

## Copyright

Copyright (C) 2022 and above Shogun (shogun@cowtech.it).

Licensed under the ISC license, which can be found at https://choosealicense.com/licenses/isc.
