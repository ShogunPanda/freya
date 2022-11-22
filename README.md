# freya-slides

[![Version](https://img.shields.io/npm/v/freya-slides.svg)](https://npm.im/freya-slides)
[![Dependencies](https://img.shields.io/librariesio/release/npm/freya-slides)](https://libraries.io/npm/freya-slides)

Opinionated JSX based slides generator.

http://sw.cowtech.it/freya-slides

## Installation

```
npx --package=freya-slides -- create-freya-slideset my-slideset
cd my-slideset
npm install
freya dev
```

## Usage

### Creating and editing slidesets

Once the installation has been completed, you can start writing your slideset.

Execute `freya dev` and it will start a server listening on `http://localhost:3000`.

Inside the `src/talks` folder you have to create a folder for each slideset, each slideset will be reachable at `http://localhost:3000/$NAME`.
Each file change will rebuild all the slidesets but the browser must be refreshed manually.

The new folders must contain at least the file `talk.yml`, with a structure similar to the following:

```
config:
  theme: main
  dimensions:
    width: 2000
    height: 1120
document:
  title:
  author:
    name:
    description:
    email:
slides:
  - title: 'Hello world!'
```

The `config.theme` value must point to a folder in the `src/themes` folder (see below).

The `document` value can contain additional keys.

The `slides` value must be an array. Each slide structure is free for you to use. freya only needs the `title`, `layout` and `notes` properties:

- `slides.*.layout` value must point to a JSX in the `src/themes/$THEME/layouts` folder.

- `slides.*.notes` value should contain speaker notes in Markdown. Layouts should not show them directly.

### Talk assets

Images and other assets can be stored in the `src/talks/$NAME/assets` folder and you can reference them using the `@talk` root folder in URLs.

When using URLs in the layout JSX, you can use the `resolveImageUrl` function to have a working URL. For instance:

```javascript
resolveImageUrl('theme', 'id', '@talk/logo.jpg')
```

### Exporting

Once you have done editing, you should execute `freya build`. Slides will be exported in the `dist/html` folder, along with a Netlify configuration file.

If you want to export as JPEG or PDF you can execute `freya jpeg` or `freya pdf`. In both cases, speaker notes will be exported as separated HTML file in the same folder.

### Presenting

During development, when accessing deployed slideset or when using `freya serve`, you can navigate slides by pressing the arrow keys, `Space`, `Enter` or `Backspace`.

You can show a list of all slides by pressing `g` or `l` and hide it by pressing `g`, `l` or the `Escape` key.

You can enter presenter mode by pressing `p`. In presenter mode, you will also see a timer (which can be stopped by pressing `s` and reset by pressing `t`), the previous and next slides and the speaker notes.

All other session of the browser connected to the same slideset will see the same slide that you are presenting.

Presenter mode can be exited by pressing `p` or the `Escape` key.

## Themes

Themes can be created by adding a new folder in the folder `src/theme`.
A theme must contain at least the following files:

- `theme.yml`: A YML file describing the theme, with the following structure:

  ```
  ---
  style: style.css
  images:
  fonts:
    ranges:
    families:
  ```

  The `style` value is optional and points to the theme's CSS file.

  The `images` value is a list of images you want to preload for the theme.

  The `fonts` value contains a definition for fonts to be loaded remotely:

  - `fonts.ranges` contains a key-value definition of UTF-8 ranges

  - `fonts.families` contains all the theme fonts families, specified with the hierachy style-weight-range-URL.

  A full `theme.yml` file might look like this:

  ```yaml
  ---
  style: style.css
  images:
    - '@theme/logo.jpg'
  fonts:
    ranges:
      latin: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD
      latin-ext: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF
    families:
      Poppins:
        normal:
          200:
            latin: https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLFj_Z1xlFd2JQEk.woff2
            latin-ext: https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLFj_Z1JlFd2JQEl8qw.woff2
  ```

- `style.css`: A CSS with theme definition. PostCSS rules like nesting and `@apply` rules are allowed.

  To import fonts, prepend: `@import 'virtual:theme-fonts';`

  Freya exposes three stylesheets which can be imported:

  - `@import '@freya/normalize.css'`: Applies [modern-normalize](https://github.com/sindresorhus/modern-normalize).
  - `@import '@freya/reset.css'`: Applies additional CSS resets.
  - `@import '@freya/default.css'`: Applies defaults styles for the grid and presenter modes.

- `unocss.config.ts`: A TypeScript file to configure [UnoCSS](https://github.com/unocss/unocss).

- `layouts/default.tsx`: A TSX/JSX file that defines a layout.

  Additional layouts file are possible and can be used by using them in the slides' `layout` key.

  A sample layout file looks like this:

  ```tsx
  import { parseContent } from '@freya/generation/generator.js'
  import { Slide, SlideProps } from '@freya/generation/models.js'

  export default function DefaultLayout({ slide, index }: SlideProps<Slide>): JSX.Element {
    const { title, content, notes } = slide

    return (
      <div key={`slide:${index}`} data-freya-id="slide" data-freya-index={index} className="freya__slide">
        <h1 dangerouslySetInnerHTML={{ __html: parseContent(title) }} />

        {content?.filter(Boolean).map((c: string, contentIndex: number) => (
          <h4 key={`content:${index}:${contentIndex}`} dangerouslySetInnerHTML={{ __html: parseContent(c) }} />
        ))}

        <template data-freya-id="slide-notes" dangerouslySetInnerHTML={{ __html: notes ?? '' }} />
      </div>
    )
  }
  ```

## ESM Only

This package only supports to be directly imported in a ESM context.

For informations on how to use it in a CommonJS context, please check [this page](https://gist.github.com/ShogunPanda/fe98fd23d77cdfb918010dbc42f4504d).

## Contributing to freya-slides

- Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
- Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
- Fork the project.
- Start a feature/bugfix branch.
- Commit and push until you are happy with your contribution.
- Make sure to add tests for it. This is important so I don't break it in a future version unintentionally.

## Copyright

Copyright (C) 2022 and above Shogun (shogun@cowtech.it).

Licensed under the ISC license, which can be found at https://choosealicense.com/licenses/isc.
