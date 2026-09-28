# @perseveranza-pets/freya

[![Version](https://img.shields.io/npm/v/@perseveranza-pets/dante.svg)](https://npm.im/@perseveranza-pets/dante)
[![Dependencies](https://img.shields.io/librariesio/release/npm/@perseveranza-pets/dante)](https://libraries.io/npm/@perseveranza-pets/dante)

Opinionated static site generator.

http://sw.cowtech.it/dante

## Installation

```bash
npx --package=@perseveranza-pets/dante -- create-dante-site my-site
cd my-site
npm install
dante dev
```

## Usage

### Extension-less slide images

Local image references can omit the extension, for example `@talk/architecture`,
`@theme/logo`, or `@common/background`. Freya selects the first existing file in
this order: `webp`, `png`, `jpg`, `bmp`. Edit the top-level `imageExtensions` array
in `src/slidesets/loaders.ts` to change that order.

The selected filename is used for slide rendering, preloading, offline caching,
and static HTML exports. Missing extension-less images produce an error listing the
searched paths. Explicit extensions are used as provided, without checking file
existence or trying other formats. Remote URLs are left unchanged.

### Preloading images used by a talk

Freya collects resolved image URLs while rendering every slide and theme component.
Only these images are preloaded and included in the talk's offline precache, with
duplicates removed after extension resolution. Asset listings and output file
copying still include the complete asset library.

Use the image resolver for images from custom YAML fields, items, layout components,
and CSS backgrounds. Literal URLs in HTML, Markdown, or stylesheets bypass the
resolver and must be declared explicitly if they need preloading or precaching.

For runtime-only image choices, declare `preloadImages` in the talk's `config` or at
the top level of `theme.yml`. These references also populate the client resolver cache:

```yaml
preloadImages:
  - '@theme/logo-light'
  - '@theme/logo-dark'
```

Declarations are resolved separately for each talk and support explicit extensions
as well as extension-less references. Static HTML exports use the same selection.

### Exporting PDFs

Run `freya pdf` to generate `dist/pdf/<talk-id>.pdf`, one screenshot-based PDF per talk.
Use `freya --only <talk-id> pdf` to select a talk, or `-d, --directory <path>` to
choose another base output directory (default: `dist`); PDFs go in its `pdf/`
subdirectory. Each PDF contains one slide per page, in slide
order, without margins or speaker notes. Page dimensions match the configured slide
dimensions in PDF points. JPEG screenshots are captured at quality 95 and embedded
without recompression or downsampling. Increasing scale changes image resolution,
not page dimensions.

HTML generation and direct JPEG capture are internal stages. Temporary files live in an
isolated `.freya-pdf-*` directory within the output directory, allowing each finished
PDF to atomically replace its destination. Intermediates are removed after each talk;
the run's temporary directory is removed on success and on errors. Existing PDFs
are replaced only after their new version is complete. Other PDFs are preserved.

CSS is compiled once per talk, with a separate shared stylesheet for speaker notes,
and incorporated before each HTML file is written once. Assets are not copied:
local image references use absolute `file://` URLs to the checkout. Logs report progress.

Use `-c, --concurrency <number>` (default: 3) to set both the maximum number of
browsers and the maximum tabs per browser. For example, `-c 5` allows five browsers
with five tabs each, up to 25 simultaneous slides. Counts are capped by available work.
Each browser takes one talk from the queue, renders its slides concurrently, and
takes another talk only after its previous PDF is assembled and intermediates removed. Different
browsers process different talks concurrently. Tabs share a context within their
browser and are reused. Logs report preparation and export times per talk, followed
by total export time including browser shutdown and temporary-file cleanup.
Each slide uses its configured dimensions and waits for fonts and decoded images,
including CSS backgrounds and SVG images. Loading failures stop the export with talk
and slide details, and Chromium is closed even after errors.
`freya deploy` first builds the HTML site, then generates PDFs with concurrency 3
and scale 2. It prepares `dist/deploy/site` from `dist/html` and copies only PDFs
generated during that invocation into `dist/deploy/site/pdfs`. Both stages respect
`--only` and `--directory`; PDFs left over from previous selections are not published.
The Netlify configuration and optional functions are included in the deployment output.

Playwright manages Chromium and captures JPEGs through reusable per-tab CDP
sessions using `Page.captureScreenshot` with `quality: 95` and `optimizeForSpeed: true`.
Chromium controls chroma subsampling. Before capture,
finite animations are finished, infinite animations are canceled and text carets
are hidden.

Use `-s, --scale <NUM>` to set a positive integer pixel density (default: 2).
The CSS viewport and slide layout stay unchanged: a 2000 × 1120 slide produces
4000 × 2240 JPEGs at scale 2, or 6000 × 3360 at scale 3.
Higher scales increase pixel count quadratically.

### Exporting editable PowerPoint presentations

Run `freya --only <talk-id> pptx` to create `pptx/<talk-id>.pptx` and
`pptx/<talk-id>.pptx-report.json`. Use `-d, --directory <path>` to change the output
directory. Each talk retains its aspect ratio on a 13⅓-inch-wide canvas, slide order,
document title/author and speaker notes. Selected presentations are replaced only
after their new PPTX has been written successfully.

The theme opts in with `data-pptx` attributes on its existing Preact markup:

```tsx
<article className="freya@slide" data-pptx="group">
  <h1 data-pptx="text">An editable title</h1>
  <img data-pptx="image" src={imageUrl} />
</article>
```

`group` includes descendants, allowing Freya to extract their native text, images,
SVGs, fills and borders from the browser's computed layout. `text`, `image`, `svg`,
`shape` and `code` identify semantic blocks; nested annotations do not duplicate
objects. `ignore` excludes a subtree. Themes without any annotations fail with a
talk/slide-specific error. Annotations do not change the HTML layout or CSS.

This initial exporter prioritizes browser-measured line positions: text remains
editable in line/style fragments rather than a single reflowing paragraph. Code
tokens and line numbers remain text. Inline backgrounds and borders become native
shapes. Groups currently produce independent objects, not PowerPoint groups.
Raster images and CSS image backgrounds are embedded as cropped PNGs; inline SVGs
and QR codes remain independent vector images, with local `<use>` references expanded.
Each vector image also contains a Chromium-rendered PNG preview for viewers that
use the compatibility representation. References to leaf SVG elements, including
embedded raster images, are preserved. Text hyperlinks are attached to their text
boxes so viewer hyperlink themes do not override CSS colors or underlining.
Their paths are not converted to native PowerPoint shapes. No whole-slide screenshots
are used.

Fonts are downloaded from Google Fonts using the families declared in Freya and
the theme's `fonts.sources`. Export requires network access. The exporter requests
complete static TrueType faces for the weights and styles used, measures text with
those same faces in Chromium, and embeds them as EOT font parts in the PPTX. Font
names and regular/bold/italic associations come from the downloaded font metadata,
preserving distinct Light and ExtraBold faces. Fonts are not subset to slide text,
so their other glyphs remain available when editing in compatible PowerPoint versions.
Generic system font stacks resolve to the theme's default declared family and are
reported. Emoji use embedded monochrome Google Noto Emoji. Missing faces, unsupported
glyphs, or fonts that prohibit editable embedding fail the export. The JSON report
also lists embedded faces, download URLs and sizes.

**Apple Keynote:** PPTX font embedding alone does not supply fonts to Keynote.
Each export also writes `<talk>.pptx-fonts.zip`, containing the exact TrueType
faces used, a font manifest and installation instructions. Extract the archive,
install its `.ttf` files using macOS Font Book, restart Keynote and import the
original PPTX again. A Keynote copy saved after font substitution may retain the
substitutions. Freya does not install fonts automatically. Without locally
available matching faces, Keynote can report missing fonts such as Montserrat
Black and substitute lighter-looking text despite the embedded PPTX fonts.

The report identifies fidelity limitations by slide ID and element, including
unsupported CSS effects, generated pseudo-content, internal text clipping and
per-object approximations of group opacity. Unsupported effects do not silently
rasterize text. Validate the result visually in PowerPoint before relying on exact
layout fidelity, especially for overlapping translucent objects and complex SVGs.

All PPTX-specific code lives in `src/pptx.ts`. It uses the existing static HTML
renderer and a separate Chromium session. Temporary HTML lives in an isolated
`.pptx-*` directory under the destination and is removed on success or failure.
The exporter does not use the PDF export's temporary files or output directories.

### Preparing a talk with the service worker

The initial HTML contains no loading text. Font files are preloaded, and the client
explicitly loads the declared font faces before mounting, even when service workers
are disabled. Failed fonts do not block mounting, and the wait is limited to 10 seconds.

When service workers are enabled, the client then mounts and displays the
theme's `layouts.loading` layout using the first slide's data, or the first slide's
normal layout when no loading layout is configured. The requested URL is preserved
and its slide is displayed once the worker finishes preparing the resource cache.
Navigation, synchronization and client actions are disabled during loading, except
for fullscreen toggling.

Configure a loading layout in `theme.yml`, referencing a file in the theme's `layouts` directory:

```yaml
layouts:
  loading: loading
```

Layouts can read `loaded: boolean` and `loadingProgress?: number` through `useClient()`.
Progress is computed from processed resources, including failed attempts, as a
percentage between 0 and 100 without rounding. An omitted progress value means
completion (`loadingProgress ?? 100`). `loaded` becomes true on completion or when
waiting is skipped; server rendering and exports also use `loaded: true`.

The manifest includes resolved talk
images and the font URLs declared by Freya and the theme. External font stylesheets
also contribute their referenced files and imports. Global image preload tags are
not emitted in talk HTML; only font preloads are retained.

The worker downloads resources sequentially, reuses its versioned cache, and allows
up to 30 seconds per download. Failed resources do not prevent the talk from opening:
normal rendering requests retry them through the network and cache successful responses.
Completion therefore does not guarantee that every resource is available offline.

The page sends a single `subscribe` message after obtaining its talk controller.
The worker replies immediately with its current state, sends `progress` every second
while preparing, and sends `completed` when all resources have been attempted.
Both messages carry a `payload` containing `talk`, `version`, `total`, `processed`,
`downloaded`, `cached`, and `failed` (an array of URLs). Discovering dependencies in
external CSS may increase `total` during preparation. The client forwards matching
messages as `freya:preload` window events, with the full message in `event.detail`.

Unsupported or disabled service workers and registration failures skip the wait.
If no matching worker status arrives for 30 seconds, the page also proceeds normally;
progress messages renew that deadline. Reopened pages subscribe again, and restarted
workers reconstruct preparation from the existing cache.

### Creating pages and files

Simply create all file needed in the `build` function in `src/build/index.ts`. You can use any framework you want, the predefined one is React.

We strongly recommend to use the `createFile` function exported from `dante` to create file as it will take care of replacing `$hash` in the file name with the actual file hash.

The function must return an object containing the following properties:

- `css`: A css to be injected in each generated HTML page.

All properties can be (async) function that will be called for each page at runtime.

### Customizing the server

If you want to customize the local server, you can create a `setupServer` function in `src/build/server.ts`. The function will receive a fastify server instance and build context.

The function can optionally return an object containing the following properties:

- `directory`: A subdirectory in the dist folder to server HTML files from.

### Exporting

Once you have done editing, you should execute `dante build`. The website will be exported in the `dist` folder.

### Adding commands to Dante

You can create a file `src/build/cli.ts` that should export a `setupCLI` function.
The function will received a [commander](https://npm.im/commander) program and a [pino](https://getpino.io) logger in order to modify the Dante CLI.

### Customize `create-dante-site`

You can create a file `src/build/create.ts` that should export a `createSetupCLI` function.
The function will received a [commander](https://npm.im/commander) program and a [pino](https://getpino.io) logger in order to modify the Dante CLI.

### Environments variables

- `DANTE_BUILD_FILE_PATH`: The build file path. Default is `src/build/index.ts`.
- `DANTE_SERVER_FILE_PATH`: The server file path. Default is `src/build/server.ts`.
- `DANTE_CLI_PATH`: The CLI customization file path. Default is `src/build/cli.ts`.
- `DANTE_CREATE_PATH`: The CLI customization file path. Default is `src/build/create.ts`.
- `DANTE_WATCH_MODULES`: If to restart the process when the Dante files in the `node_modules` folder are changed.
- `DANTE_WATCH_ADDITIONAL_PATHS`: Which additional paths to watch.
- `DANTE_NODE_ADDITIONAL_OPTIONS`: Additional options to pass to the node executable.
- `DANTE_PROGRAM_NAME`: The name to show when doing `dante --help`. This is mostly for NPM modules extending Dante.
- `DANTE_PROGRAM_DESCRIPTION`: The name to show when doing `dante --help`. This is mostly for NPM modules extending Dante.

## ESM Only

This package only supports to be directly imported in a ESM context.

For informations on how to use it in a CommonJS context, please check [this page](https://gist.github.com/ShogunPanda/fe98fd23d77cdfb918010dbc42f4504d).

## Contributing to dante

- Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
- Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
- Fork the project.
- Start a feature/bugfix branch.
- Commit and push until you are happy with your contribution.
- Make sure to add tests for it. This is important so I don't break it in a future version unintentionally.

## Copyright

Copyright (C) 2022 and above Shogun (shogun@cowtech.it).

Licensed under the ISC license, which can be found at https://choosealicense.com/licenses/isc.
