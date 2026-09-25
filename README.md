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
and PNG/PDF exports. Missing extension-less images produce an error listing the
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
as well as extension-less references. PNG/PDF exports use the same selection.

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
